/**
 * ParentPortal.js — Controlador do Portal da Família (Animal Island UI Standard)
 * Gerencia rotas, verificação parental com documento e reconhecimento facial gratuito.
 */

import { ParentFaceScanner } from './ParentFaceScanner.js';
import { ParentDashboardView } from './ParentDashboardView.js';

export class ParentPortal {
  constructor() {
    this.token = null;
    this.childData = null;
    this.currentStep = 1;
    this.faceScanner = null;
    this.documentVerified = false;
    this.facialVerified = false;
    this.estimatedAge = null;
    this.parentToken = localStorage.getItem('kidslearn_parent_token') || null;
    this.dashboardView = new ParentDashboardView(this);

    this.initElements();
    this.bindEvents();
    this.detectRoute();
  }

  initElements() {
    this.secVerify = document.getElementById('section-verification');
    this.secLogin = document.getElementById('section-parent-login');
    this.secDash = document.getElementById('section-dashboard');
    this.alertBox = document.getElementById('portal-status-alert');
    this.headerActions = document.getElementById('parent-auth-header-actions');

    this.step1 = document.getElementById('verify-step-1');
    this.step2 = document.getElementById('verify-step-2');
    this.step3 = document.getElementById('verify-step-3');
    this.stepSuccess = document.getElementById('verify-step-success');
    this.stepIndicator = document.getElementById('verification-step-indicator');

    this.inputName = document.getElementById('parent-full-name');
    this.inputDocType = document.getElementById('parent-doc-type');
    this.inputPass = document.getElementById('parent-new-password');
    this.btnStep2 = document.getElementById('btn-goto-step-2');
    this.btnBackStep1 = document.getElementById('btn-back-to-step-1');
    this.btnStep3 = document.getElementById('btn-goto-step-3');
    this.btnBackStep2 = document.getElementById('btn-back-to-step-2');
    this.btnConfirm = document.getElementById('btn-confirm-verification');
    this.btnOpenDash = document.getElementById('btn-open-dashboard');

    this.docFileInput = document.getElementById('doc-file-input');
    this.docPreviewWrapper = document.getElementById('doc-preview-wrapper');
    this.docCanvas = document.getElementById('doc-preview-canvas');

    this.video = document.getElementById('camera-stream');
    this.guide = document.getElementById('face-oval-guide');
    this.feedback = document.getElementById('camera-feedback-badge');
  }

  bindEvents() {
    this.btnStep2?.addEventListener('click', () => this.handleStep1Submit());
    this.btnBackStep1?.addEventListener('click', () => this.showStep(1));
    this.btnStep3?.addEventListener('click', () => this.handleStep2Submit());
    this.btnBackStep2?.addEventListener('click', () => {
      this.faceScanner?.stop();
      this.showStep(2);
    });
    this.btnConfirm?.addEventListener('click', () => this.submitVerification());
    this.btnOpenDash?.addEventListener('click', () => this.loadDashboard());

    this.docFileInput?.addEventListener('change', (e) => this.handleDocFile(e));

    document.getElementById('parent-login-form')?.addEventListener('submit', (e) => this.handleParentLogin(e));

    document.getElementById('time-limit-selector')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-time-pill');
      if (!btn) return;
      document.querySelectorAll('.btn-time-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    document.getElementById('btn-save-time-limit')?.addEventListener('click', () => {
      this.dashboardView.saveTimeLimit(this.parentToken, () => this.loadDashboard());
    });
  }

  detectRoute() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const token = params.get('token');

    if (action === 'verify' && token) {
      this.token = token;
      this.startVerificationFlow();
    } else if (this.parentToken) {
      this.loadDashboard();
    } else {
      this.showLoginView();
    }
  }

  async startVerificationFlow() {
    this.showSection('verify');
    this.showStep(1);

    try {
      const res = await fetch(`/api/parent/verify-token?token=${encodeURIComponent(this.token)}`);
      const data = await res.json();
      if (!res.ok || !data.valid) return this.showAlert(data.error || 'Link expirado ou inválido.', 'error');
      this.childData = data;
      const childNameEl = document.getElementById('verify-child-name');
      if (childNameEl) childNameEl.innerText = data.childNickname;
    } catch (_) {
      this.showAlert('Não foi possível validar o link com o servidor.', 'error');
    }
  }

  handleStep1Submit() {
    const name = this.inputName?.value.trim();
    const pass = this.inputPass?.value.trim();
    if (!name || name.length < 3) return alert('Por favor, informe seu nome completo.');
    if (!pass || pass.length < 6) return alert('Defina uma senha de no mínimo 6 caracteres.');
    this.showStep(2);
  }

  handleDocFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 500 / img.width);
        this.docCanvas.width = img.width * scale;
        this.docCanvas.height = img.height * scale;
        const ctx = this.docCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, this.docCanvas.width, this.docCanvas.height);

        this.documentVerified = true;
        if (this.docPreviewWrapper) this.docPreviewWrapper.style.display = 'block';
        if (this.btnStep3) this.btnStep3.disabled = false;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  handleStep2Submit() {
    if (!this.documentVerified) return alert('Selecione ou tire a foto do documento.');
    this.showStep(3);
    this.faceScanner = new ParentFaceScanner(this.video, this.guide, this.feedback);
    this.faceScanner.startCamera((result) => {
      this.facialVerified = result.faceDetected;
      this.estimatedAge = result.estimatedAge;
      if (this.btnConfirm) this.btnConfirm.disabled = false;
    });
  }

  async submitVerification() {
    if (!this.facialVerified) return alert('Aguarde o reconhecimento facial concluir.');
    if (this.btnConfirm) {
      this.btnConfirm.disabled = true;
      this.btnConfirm.innerText = 'Liberando acesso...';
    }

    try {
      const payload = {
        token: this.token,
        parentName: this.inputName.value.trim(),
        password: this.inputPass.value.trim(),
        docType: this.inputDocType.value,
        estimatedAge: this.estimatedAge
      };

      const res = await fetch('/api/parent/complete-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.faceScanner?.stop();
        if (data.parentToken) {
          localStorage.setItem('kidslearn_parent_token', data.parentToken);
          this.parentToken = data.parentToken;
        }
        const successName = document.getElementById('success-child-name');
        if (successName) successName.innerText = data.child?.nickname || 'Aventureiro';
        this.showStep('success');
      } else {
        alert(data.error || 'Falha ao concluir verificação.');
        if (this.btnConfirm) this.btnConfirm.disabled = false;
      }
    } catch (_) {
      alert('Erro de conexão ao enviar a confirmação.');
      if (this.btnConfirm) this.btnConfirm.disabled = false;
    }
  }

  async handleParentLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-parent-email')?.value.trim();
    const password = document.getElementById('login-parent-password')?.value.trim();

    try {
      const res = await fetch('/api/parent/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('kidslearn_parent_token', data.token);
        this.parentToken = data.token;
        this.loadDashboard();
      } else {
        alert(data.error || 'Credenciais inválidas.');
      }
    } catch (_) {
      alert('Falha ao conectar com o servidor.');
    }
  }

  async loadDashboard() {
    this.showSection('dashboard');
    this.renderHeaderUser();

    try {
      const res = await fetch('/api/parent/dashboard', {
        headers: { 'Authorization': `Bearer ${this.parentToken}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        localStorage.removeItem('kidslearn_parent_token');
        return this.showLoginView();
      }
      const child = data.children?.[0] || null;
      if (child) this.dashboardView.renderChildProgress(child);
    } catch (_) {
      this.showAlert('Erro ao carregar dados do dashboard.', 'error');
    }
  }

  showStep(step) {
    this.currentStep = step;
    if (this.step1) this.step1.style.display = step === 1 ? 'block' : 'none';
    if (this.step2) this.step2.style.display = step === 2 ? 'block' : 'none';
    if (this.step3) this.step3.style.display = step === 3 ? 'block' : 'none';
    if (this.stepSuccess) this.stepSuccess.style.display = step === 'success' ? 'block' : 'none';

    if (this.stepIndicator) {
      const titles = {
        1: 'Etapa 1 de 3: Identificação do Responsável',
        2: 'Etapa 2 de 3: Conferência Privada de Documento',
        3: 'Etapa 3 de 3: Reconhecimento Facial',
        success: 'Verificação Concluída'
      };
      this.stepIndicator.innerText = titles[step] || '';
    }
  }

  showSection(section) {
    if (this.secVerify) this.secVerify.style.display = section === 'verify' ? 'block' : 'none';
    if (this.secLogin) this.secLogin.style.display = section === 'login' ? 'block' : 'none';
    if (this.secDash) this.secDash.style.display = section === 'dashboard' ? 'block' : 'none';
  }

  showLoginView() {
    this.showSection('login');
    if (this.headerActions) this.headerActions.innerHTML = '';
  }

  renderHeaderUser() {
    if (!this.headerActions) return;
    this.headerActions.innerHTML = `
      <button type="button" id="btn-parent-logout" class="portal-btn portal-btn-wood" style="padding: 8px 20px; font-size: 0.82rem;">
        Sair
      </button>
    `;
    document.getElementById('btn-parent-logout')?.addEventListener('click', () => {
      localStorage.removeItem('kidslearn_parent_token');
      this.parentToken = null;
      this.showLoginView();
    });
  }

  showAlert(message, type = 'info') {
    if (!this.alertBox) return;
    this.alertBox.style.display = 'block';
    this.alertBox.innerText = message;
    this.alertBox.className = `portal-alert alert-${type}`;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.parentPortal = new ParentPortal();
  });
}
