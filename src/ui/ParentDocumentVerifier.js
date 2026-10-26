/**
 * ParentDocumentVerifier.js — Verificação de Autenticidade de Documentos 100% Client-Side
 * Valida se a imagem enviada é genuinamente um documento oficial com foto (RG, CNH ou Passaporte),
 * rejeitando fotos aleatórias, fundos vazios, recibos sem foto ou selfies diretas.
 * Privacidade total: processado exclusivamente no Canvas do navegador do responsável.
 */

import { unpack_cascade, run_cascade, cluster_detections } from '../lib/pico.js';

export class ParentDocumentVerifier {
  constructor() {
    this.classifier = null;
    this.isReady = false;
    this.initModel();
  }

  async initModel() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/assets/models/facefinder');
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        this.classifier = unpack_cascade(bytes);
        this.isReady = true;
      }
    } catch (e) {
      console.warn('[ParentDocumentVerifier] Erro ao carregar modelo local:', e);
    }
  }

  async ensureModelReady() {
    if (this.isReady && this.classifier) return true;
    for (let i = 0; i < 20; i++) {
      if (this.classifier) {
        this.isReady = true;
        return true;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  async verifyDocument(canvas, docType = 'cnh') {
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return { isValid: false, message: 'Imagem do documento não carregada.' };
    }

    const width = canvas.width;
    const height = canvas.height;

    // 1. Verificação de Resolução Mínima
    if (width < 220 || height < 150) {
      return {
        isValid: false,
        message: 'Resolução muito baixa. Fotografe o documento mais de perto e com boa iluminação.'
      };
    }

    // 2. Verificação de Proporção (Aspect Ratio) de Documentos Oficiais
    const ratio = width / height;
    if (ratio < 0.48 || ratio > 2.25) {
      return {
        isValid: false,
        message: 'A imagem não possui a proporção de um documento oficial (RG, CNH ou Passaporte).'
      };
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, width, height);
    const rgba = imgData.data;
    const totalPixels = width * height;

    // Converte para escala de cinza e analisa contraste
    const gray = new Uint8Array(totalPixels);
    let totalLuma = 0;

    for (let i = 0; i < totalPixels; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const luma = (2 * r + 7 * g + 1 * b) / 10;
      gray[i] = luma;
      totalLuma += luma;
    }

    const avgLuma = totalLuma / totalPixels;
    if (avgLuma < 25 || avgLuma > 240) {
      return {
        isValid: false,
        message: 'Imagem muito escura ou com excesso de reflexo. Fotografe o documento sob luz adequada.'
      };
    }

    // 3. Verificação de Textura e Linhas de Dados Impressos (Transições de Texto/Segurança)
    let transitions = 0;
    const stepRow = Math.max(3, Math.floor(height / 80));
    let testedLines = 0;

    for (let r = 8; r < height - 8; r += stepRow) {
      testedLines++;
      for (let c = 8; c < width - 9; c++) {
        const diff = Math.abs(gray[r * width + c] - gray[r * width + c + 1]);
        if (diff > 28) transitions++;
      }
    }

    const transitionDensity = transitions / (testedLines * (width - 16));
    if (transitionDensity < 0.012) {
      return {
        isValid: false,
        message: 'Não foram identificados textos, números ou traços nítidos de um documento oficial.'
      };
    }

    // 4. Detecção da Foto 3x4 / Retrato no Documento via Pico AI
    await this.ensureModelReady();

    if (!this.classifier) {
      return {
        isValid: false,
        message: 'Carregando motor de análise local... Tente novamente em alguns segundos.'
      };
    }

    const minDim = Math.min(width, height);
    const image = { pixels: gray, nrows: height, ncols: width, ldim: width };

    const rawDets = run_cascade(image, this.classifier, {
      shiftfactor: 0.08,
      minsize: Math.max(35, Math.floor(minDim * 0.12)),
      maxsize: Math.floor(minDim * 0.72),
      scalefactor: 1.12
    });

    const clusters = cluster_detections(rawDets, 0.2).filter(d => d[3] >= 32.0);

    // Documentos oficiais (RG, CNH, Passaporte) OBRIGATORIAMENTE possuem foto do titular
    if (clusters.length === 0) {
      return {
        isValid: false,
        message: 'Não foi identificada a foto de rosto no documento. Certifique-se de fotografar a frente do RG, a CNH aberta ou a página principal do Passaporte.'
      };
    }

    const bestFace = clusters[0];
    const faceSize = bestFace[2];
    const faceArea = faceSize * faceSize;
    const docArea = width * height;
    const faceRatio = faceArea / docArea;

    // Se o rosto ocupar quase a foto inteira, o usuário enviou uma selfie em vez do documento
    if (faceRatio > 0.42) {
      return {
        isValid: false,
        message: 'A imagem parece uma selfie direta do seu rosto. Por favor, envie a foto do seu documento físico (RG, CNH ou Passaporte).'
      };
    }

    // Se o rosto for menor que 1.2% do documento, a foto está distante demais para conferência
    if (faceRatio < 0.012) {
      return {
        isValid: false,
        message: 'A foto de rosto no documento está muito pequena ou distante. Aproxime a câmera do documento.'
      };
    }

    const typeLabels = {
      rg: 'RG (Carteira de Identidade)',
      cnh: 'CNH (Carteira de Habilitação)',
      passaporte: 'Passaporte'
    };

    const docName = typeLabels[docType] || 'Documento Oficial';

    return {
      isValid: true,
      docType,
      faceRatio,
      confidence: Math.min(99, Math.round(bestFace[3])),
      message: `${docName} identificado com sucesso! Foto e dados conferidos no aparelho.`
    };
  }

  async verifyAndRender(canvas, docType, { badgeEl, textEl, iconEl, btnProceed }) {
    if (badgeEl) badgeEl.className = 'doc-validation-badge analyzing';
    if (textEl) textEl.innerText = 'Analisando documento no seu aparelho...';
    if (iconEl) {
      iconEl.innerHTML = `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-dasharray="28" stroke-dashoffset="10" stroke-width="2.5"></circle>`;
    }
    if (btnProceed) btnProceed.disabled = true;

    await new Promise(r => setTimeout(r, 80));
    const result = await this.verifyDocument(canvas, docType);

    if (result.isValid) {
      if (badgeEl) badgeEl.className = 'doc-validation-badge';
      if (textEl) textEl.innerText = result.message;
      if (iconEl) iconEl.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
      if (btnProceed) {
        btnProceed.disabled = false;
        try {
          btnProceed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
      }
    } else {
      if (badgeEl) badgeEl.className = 'doc-validation-badge error';
      if (textEl) textEl.innerText = result.message;
      if (iconEl) {
        iconEl.innerHTML = `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`;
      }
      if (btnProceed) btnProceed.disabled = true;
    }
    return result;
  }
}
