/**
 * AnimalIslandDatePicker.js — Calendário Aconchegante Animal Island UI
 * Permite seleção visual prática ou digitação direta com máscara (DD/MM/AAAA).
 * Zero dependências externas e zero emojis (100% inline SVG).
 */

export function calculateAgeFromDate(day, month, year) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = (today.getMonth() + 1) - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}

export class AnimalIslandDatePicker {
  constructor({ inputElement, triggerButton, onDateChange }) {
    this.input = inputElement;
    this.trigger = triggerButton;
    this.onDateChange = onDateChange;

    const now = new Date();
    // Ano inicial padrão: ~10 anos atrás (ideal para o público infantil)
    this.currentYear = now.getFullYear() - 10;
    this.currentMonth = now.getMonth(); // 0 a 11
    this.selectedDate = null;
    this.isOpen = false;

    this.months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    this.createPopover();
    this.bindEvents();
  }

  createPopover() {
    this.popover = document.createElement('div');
    this.popover.className = 'animal-datepicker-popover';
    this.popover.style.display = 'none';

    this.popover.innerHTML = `
      <div class="animal-dp-header">
        <button type="button" class="animal-dp-nav-btn" id="dp-btn-prev-month" aria-label="Mês anterior">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="animal-dp-selectors">
          <select class="animal-dp-select" id="dp-select-month"></select>
          <select class="animal-dp-select" id="dp-select-year"></select>
        </div>
        <button type="button" class="animal-dp-nav-btn" id="dp-btn-next-month" aria-label="Próximo mês">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
      <div class="animal-dp-weekdays">
        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
      </div>
      <div class="animal-dp-days" id="dp-days-grid"></div>
      <div class="animal-dp-footer">
        <button type="button" class="animal-dp-foot-btn" id="dp-btn-today">Hoje</button>
        <button type="button" class="animal-dp-foot-btn" id="dp-btn-close">Fechar</button>
      </div>
    `;

    // Posiciona logo abaixo do input
    if (this.input?.parentNode) {
      this.input.parentNode.style.position = 'relative';
      this.input.parentNode.appendChild(this.popover);
    }

    this.initSelectors();
  }

  initSelectors() {
    const selMonth = this.popover.querySelector('#dp-select-month');
    const selYear = this.popover.querySelector('#dp-select-year');

    this.months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.innerText = m;
      selMonth.appendChild(opt);
    });

    const maxYear = new Date().getFullYear();
    for (let y = maxYear; y >= 1920; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.innerText = y;
      selYear.appendChild(opt);
    }
  }

  bindEvents() {
    // Abertura / Fechamento
    this.trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.input?.addEventListener('click', () => {
      if (!this.isOpen) this.open();
    });

    // Digitação direta com máscara DD/MM/AAAA
    this.input?.addEventListener('input', () => this.handleDirectInput());

    // Navegação do Popover
    this.popover.querySelector('#dp-btn-prev-month')?.addEventListener('click', () => this.changeMonth(-1));
    this.popover.querySelector('#dp-btn-next-month')?.addEventListener('click', () => this.changeMonth(1));

    const selMonth = this.popover.querySelector('#dp-select-month');
    selMonth?.addEventListener('change', () => {
      this.currentMonth = parseInt(selMonth.value, 10);
      this.renderDays();
    });

    const selYear = this.popover.querySelector('#dp-select-year');
    selYear?.addEventListener('change', () => {
      this.currentYear = parseInt(selYear.value, 10);
      this.renderDays();
    });

    this.popover.querySelector('#dp-btn-today')?.addEventListener('click', () => {
      const now = new Date();
      this.selectDate(now.getDate(), now.getMonth(), now.getFullYear());
    });

    this.popover.querySelector('#dp-btn-close')?.addEventListener('click', () => this.close());

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.popover.contains(e.target) && e.target !== this.input && e.target !== this.trigger && !this.trigger?.contains(e.target)) {
        this.close();
      }
    });
  }

  handleDirectInput() {
    let val = this.input.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);

    // Aplica máscara DD/MM/AAAA
    let masked = val;
    if (val.length >= 5) {
      masked = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length >= 3) {
      masked = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    this.input.value = masked;

    if (val.length === 8) {
      const day = parseInt(val.slice(0, 2), 10);
      const month = parseInt(val.slice(2, 4), 10);
      const year = parseInt(val.slice(4, 8), 10);

      const isValid = this.isValidDate(day, month, year);
      if (isValid) {
        this.currentYear = year;
        this.currentMonth = month - 1;
        this.selectedDate = { day, month: month - 1, year };
        this.renderDays();
        this.emitChange(day, month, year, true);
      } else {
        this.emitChange(null, null, null, false);
      }
    } else {
      this.emitChange(null, null, null, false);
    }
  }

  isValidDate(day, month, year) {
    const maxYear = new Date().getFullYear();
    if (year < 1920 || year > maxYear || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
  }

  renderDays() {
    const selMonth = this.popover.querySelector('#dp-select-month');
    const selYear = this.popover.querySelector('#dp-select-year');
    if (selMonth) selMonth.value = this.currentMonth;
    if (selYear) selYear.value = this.currentYear;

    const grid = this.popover.querySelector('#dp-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const today = new Date();

    // Espaços vazios antes do 1º dia
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      empty.className = 'animal-dp-day-btn empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'animal-dp-day-btn';
      btn.innerText = d;

      const isToday = today.getDate() === d && today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;
      if (isToday) btn.classList.add('today');

      const isSel = this.selectedDate && this.selectedDate.day === d && this.selectedDate.month === this.currentMonth && this.selectedDate.year === this.currentYear;
      if (isSel) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        this.selectDate(d, this.currentMonth, this.currentYear);
      });

      grid.appendChild(btn);
    }
  }

  selectDate(day, monthIndex, year) {
    this.selectedDate = { day, month: monthIndex, year };
    const monthNumber = monthIndex + 1;
    const dd = String(day).padStart(2, '0');
    const mm = String(monthNumber).padStart(2, '0');
    this.input.value = `${dd}/${mm}/${year}`;

    this.renderDays();
    this.emitChange(day, monthNumber, year, true);
    this.close();
  }

  emitChange(day, month, year, isValid) {
    if (typeof this.onDateChange !== 'function') return;
    if (!isValid) {
      return this.onDateChange({ isValid: false, age: null, dateStr: '' });
    }
    const age = calculateAgeFromDate(day, month, year);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.onDateChange({ isValid: true, day, month, year, age, dateStr });
  }

  changeMonth(delta) {
    this.currentMonth += delta;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.renderDays();
  }

  open() {
    this.isOpen = true;
    this.popover.style.display = 'block';
    this.renderDays();
  }

  close() {
    this.isOpen = false;
    this.popover.style.display = 'none';
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
