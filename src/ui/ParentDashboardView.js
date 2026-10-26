/**
 * ParentDashboardView.js — Visualização e Controles do Dashboard Parental
 * Exibe evolução pedagógica (Blockly/Lua), dragões e seletor de tempo diário de tela.
 */

export class ParentDashboardView {
  constructor(portalInstance) {
    this.portal = portalInstance;
    this.activeChildId = null;
  }

  renderChildProgress(child) {
    this.activeChildId = child.id;
    const nickEl = document.getElementById('dash-child-nickname');
    const emailEl = document.getElementById('dash-child-email');
    const levelEl = document.getElementById('dash-child-level');
    const xpEl = document.getElementById('dash-child-xp');
    const goldEl = document.getElementById('dash-child-gold');

    if (nickEl) nickEl.innerText = child.nickname;
    if (emailEl) emailEl.innerText = child.email;
    if (levelEl) levelEl.innerText = `Nível ${child.level || 1}`;
    if (xpEl) xpEl.innerText = `${child.xp || 0} XP`;
    if (goldEl) goldEl.innerText = `${child.gold || 0} Moedas`;

    this.renderTimeLimit(child);
    this.renderLearning(child);
    this.renderDragons(child.dragons || []);
  }

  renderTimeLimit(child) {
    const minutes = child.dailyTimeLimitMinutes;
    const timeSelector = document.getElementById('time-limit-selector');
    timeSelector?.querySelectorAll('.btn-time-pill').forEach(btn => {
      const btnMin = btn.dataset.minutes;
      const isActive = (minutes === null && btnMin === 'unlimited') || (String(minutes) === btnMin);
      btn.classList.toggle('active', isActive);
    });

    const played = child.minutesPlayedToday || 0;
    const usageText = document.getElementById('dash-today-usage-text');
    if (usageText) {
      usageText.innerText = `${played} min jogados ${minutes ? `(de ${minutes} min)` : '(Ilimitado)'}`;
    }
    const fill = document.getElementById('dash-usage-progress-fill');
    if (fill) {
      fill.style.width = minutes ? `${Math.min(100, Math.round((played / minutes) * 100))}%` : '0%';
    }
  }

  renderLearning(child) {
    const completed = child.codingProgress?.completedLessons || [];
    const countEl = document.getElementById('dash-lessons-completed-count');
    if (countEl) countEl.innerText = completed.length;

    const learnFill = document.getElementById('dash-learning-progress-fill');
    if (learnFill) {
      learnFill.style.width = `${Math.min(100, Math.round((completed.length / 25) * 100))}%`;
    }

    this.renderConcepts(completed);
    this.renderUnlockedAssets(child.codingProgress?.unlockedAssets || []);
  }

  renderConcepts(completed) {
    const concepts = [
      { id: 'bambu_01_chair', name: 'Variáveis Simples', mentor: 'Bambu, o Engenheiro' },
      { id: 'bambu_02_table', name: 'Atribuição & Parâmetros', mentor: 'Bambu, o Engenheiro' },
      { id: 'bambu_03_bridge', name: 'Loops & Repetições', mentor: 'Bambu, o Engenheiro' },
      { id: 'bambu_04_lamp', name: 'Condicionais IF/ELSE', mentor: 'Bambu, o Engenheiro' },
      { id: 'bambu_05_fountain', name: 'Funções Avançadas', mentor: 'Bambu, o Engenheiro' }
    ];

    const container = document.getElementById('dash-concepts-container');
    if (!container) return;
    container.innerHTML = concepts.map(c => {
      const isDone = completed.includes(c.id);
      return `
        <div class="concept-card ${isDone ? 'completed' : ''}">
          <svg viewBox="0 0 24 24" class="ui-icon" style="color: ${isDone ? '#10b981' : '#c4b89e'};" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <div>
            <div style="font-weight: 800; font-size: 0.85rem;">${c.name}</div>
            <div style="font-size: 0.75rem; color: var(--animal-text-muted);">${c.mentor}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderUnlockedAssets(unlocked) {
    const container = document.getElementById('dash-unlocked-assets');
    if (!container) return;
    container.innerHTML = unlocked.length > 0 
      ? unlocked.map(a => `<span class="asset-pill">${a.replace('prop_', '').replace('_', ' ')}</span>`).join('')
      : '<span style="font-size:0.85rem;color:var(--animal-text-muted);">Nenhum item desbloqueado ainda.</span>';
  }

  renderDragons(dragons) {
    const container = document.getElementById('dash-dragons-container');
    if (!container) return;
    container.innerHTML = dragons.length > 0
      ? dragons.map(d => `
        <div class="dragon-portal-card">
          <div class="dragon-portal-name">${d.name}</div>
          <div class="dragon-portal-lvl">Nível ${d.level} • ${d.element}</div>
        </div>
      `).join('')
      : '<p style="font-size:0.85rem;color:var(--animal-text-muted);">Nenhum dragão recrutado ainda.</p>';
  }

  async saveTimeLimit(parentToken, onSavedCallback) {
    const activeBtn = document.querySelector('.btn-time-pill.active');
    const minutes = activeBtn ? activeBtn.dataset.minutes : 'unlimited';

    try {
      const res = await fetch('/api/parent/time-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parentToken}`
        },
        body: JSON.stringify({ childId: this.activeChildId, minutes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Limite diário atualizado com sucesso!');
        if (typeof onSavedCallback === 'function') onSavedCallback();
      } else {
        alert(data.error || 'Falha ao salvar limite.');
      }
    } catch (_) {
      alert('Erro de conexão ao atualizar limite.');
    }
  }
}
