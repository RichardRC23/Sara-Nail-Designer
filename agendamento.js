const menuBotao = document.querySelector('.menu-botao');
const menu = document.querySelector('.menu');
const authCard = document.querySelector('#authCard');
const dashboard = document.querySelector('#dashboard');
const authStatus = document.querySelector('#authStatus');
const appointmentStatus = document.querySelector('#appointmentStatus');
const loginPanel = document.querySelector('#loginPanel');
const signupPanel = document.querySelector('#signupPanel');
const recoveryPanel = document.querySelector('#recoveryPanel');
const newPasswordPanel = document.querySelector('#newPasswordPanel');
const authTabs = document.querySelector('#authTabs');
let supabaseClient;
let recoveryFlow = false;

const setMenuOpen = (open) => {
  menu.classList.toggle('aberto', open);
  menuBotao.setAttribute('aria-expanded', String(open));
};

menuBotao.addEventListener('click', () => setMenuOpen(!menu.classList.contains('aberto')));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
document.querySelector('#ano').textContent = new Date().getFullYear();

const revealObserver = new IntersectionObserver((items) => {
  items.forEach((item) => {
    if (item.isIntersecting) {
      item.target.classList.add('visivel');
      revealObserver.unobserve(item.target);
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.revelar').forEach((element) => revealObserver.observe(element));

const showMessage = (element, message) => {
  element.textContent = message;
};

const setBusy = (form, busy) => {
  form.querySelectorAll('button[type="submit"]').forEach((button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  });
};

const friendlyAuthError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email ou senha não conferem. Confira os dados e tente novamente.';
  if (message.includes('email not confirmed')) return 'Confirme seu email pelo link enviado antes de entrar.';
  if (message.includes('password should be at least')) return 'Escolha uma senha com pelo menos 8 caracteres.';
  if (message.includes('already registered') || message.includes('already been registered')) return 'Se esse email ainda não tem conta confirmada, confira sua caixa de entrada. Caso já tenha cadastro, entre pela aba “Entrar”.';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.';
  return 'Não foi possível concluir agora. Confira a conexão e tente novamente.';
};

const setAuthMode = (mode) => {
  const loginSelected = mode === 'login';
  document.querySelector('#loginTab').setAttribute('aria-selected', String(loginSelected));
  document.querySelector('#signupTab').setAttribute('aria-selected', String(!loginSelected));
  loginPanel.hidden = !loginSelected;
  signupPanel.hidden = loginSelected;
  recoveryPanel.hidden = true;
  newPasswordPanel.hidden = true;
  authTabs.hidden = false;
  document.querySelector('#authTitle').textContent = loginSelected ? 'Que bom ter você aqui' : 'Vamos criar seu acesso';
  showMessage(authStatus, '');
};

document.querySelector('#loginTab').addEventListener('click', () => setAuthMode('login'));
document.querySelector('#signupTab').addEventListener('click', () => setAuthMode('signup'));

const configureDateMinimum = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelector('#appointmentDate').min = localDate;
};

const serviceFromQuery = new Map([
  ['gel', 'Esmaltação em gel'],
  ['nail-art', 'Nail art personalizada'],
  ['alongamento', 'Alongamento']
]);
const requestedService = serviceFromQuery.get(new URLSearchParams(window.location.search).get('servico'));
if (requestedService) document.querySelector('#service').value = requestedService;
configureDateMinimum();

const showDashboard = (session) => {
  const user = session?.user;
  authCard.hidden = Boolean(user);
  dashboard.hidden = !user;
  if (!user) return;

  const metadataName = user.user_metadata?.full_name;
  const fallbackName = user.email?.split('@')[0] || 'que bom ver você';
  document.querySelector('#customerName').textContent = metadataName || fallbackName;
  document.querySelector('#customerEmail').textContent = user.email || '';
  void loadAppointments();
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const dateLabel = (value) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'long', year: 'numeric'
}).format(new Date(`${value}T12:00:00`));

const statusLabel = (status) => ({
  requested: 'Aguardando confirmação da Sara',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado'
}[status] || 'Aguardando retorno');

async function loadAppointments() {
  const list = document.querySelector('#appointmentsList');
  list.innerHTML = '<p class="pedido-carregando">Carregando seus pedidos…</p>';

  const { data, error } = await supabaseClient
    .from('appointments')
    .select('id, service, requested_date, requested_time, notes, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = '<p class="pedidos-vazio">Ainda falta configurar a tabela de agendamentos. O responsável pelo site deve executar o arquivo <code>supabase/schema.sql</code> no Supabase.</p>';
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="pedidos-vazio">Seus pedidos aparecerão aqui depois que você solicitar um horário.</p>';
    return;
  }

  list.innerHTML = data.map((item) => `
    <article class="pedido-item">
      <h4>${escapeHtml(item.service)}</h4>
      <p>${escapeHtml(dateLabel(item.requested_date))} · ${escapeHtml(String(item.requested_time).slice(0, 5))}</p>
      <span class="pedido-status">${escapeHtml(statusLabel(item.status))}</span>
      ${item.notes ? `<p class="pedido-nota">${escapeHtml(item.notes)}</p>` : ''}
    </article>
  `).join('');
}

const showRecoveryPanel = () => {
  recoveryFlow = true;
  authTabs.hidden = true;
  loginPanel.hidden = true;
  signupPanel.hidden = true;
  recoveryPanel.hidden = true;
  newPasswordPanel.hidden = false;
  document.querySelector('#authTitle').textContent = 'Escolha uma nova senha';
  showMessage(authStatus, '');
};

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  showMessage(authStatus, 'Entrando…');
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: String(values.get('email')).trim(),
    password: String(values.get('password'))
  });
  setBusy(form, false);
  if (error) {
    showMessage(authStatus, friendlyAuthError(error));
    return;
  }
  showMessage(authStatus, '');
  showDashboard(data.session);
});

document.querySelector('#signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  showMessage(authStatus, 'Criando sua conta…');
  const { data, error } = await supabaseClient.auth.signUp({
    email: String(values.get('email')).trim(),
    password: String(values.get('password')),
    options: {
      data: { full_name: String(values.get('name')).trim() },
      emailRedirectTo: `${window.location.origin}/agendamento.html`
    }
  });
  setBusy(form, false);
  if (error) {
    showMessage(authStatus, friendlyAuthError(error));
    return;
  }
  if (data.session) {
    showMessage(authStatus, 'Conta criada! Agora escolha o serviço e o horário que prefere.');
    showDashboard(data.session);
  } else {
    setAuthMode('login');
    showMessage(authStatus, 'Conta criada. Enviamos um link de confirmação para seu email; confirme-o para entrar.');
  }
});

document.querySelector('#resetPassword').addEventListener('click', () => {
  authTabs.hidden = true;
  loginPanel.hidden = true;
  signupPanel.hidden = true;
  recoveryPanel.hidden = false;
  newPasswordPanel.hidden = true;
  document.querySelector('#authTitle').textContent = 'Recupere seu acesso';
  document.querySelector('#recoveryEmail').value = document.querySelector('#loginEmail').value;
  showMessage(authStatus, '');
});

document.querySelector('#backToLogin').addEventListener('click', () => setAuthMode('login'));

document.querySelector('#recoveryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true);
  showMessage(authStatus, 'Enviando instruções…');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(String(values.get('email')).trim(), {
    redirectTo: `${window.location.origin}/agendamento.html?recuperar=1`
  });
  setBusy(form, false);
  showMessage(authStatus, error ? friendlyAuthError(error) : 'Se houver uma conta com esse email, você receberá um link para redefinir a senha.');
});

document.querySelector('#newPasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = String(new FormData(form).get('password'));
  setBusy(form, true);
  showMessage(authStatus, 'Atualizando sua senha…');
  const { error } = await supabaseClient.auth.updateUser({ password });
  setBusy(form, false);
  if (error) {
    showMessage(authStatus, friendlyAuthError(error));
    return;
  }
  await supabaseClient.auth.signOut();
  recoveryFlow = false;
  setAuthMode('login');
  showMessage(authStatus, 'Senha atualizada. Agora entre com sua nova senha.');
  window.history.replaceState({}, '', window.location.pathname);
});

document.querySelector('#appointmentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const requestedDate = String(values.get('date'));
  configureDateMinimum();
  if (requestedDate < document.querySelector('#appointmentDate').min) {
    showMessage(appointmentStatus, 'Escolha uma data de hoje em diante.');
    return;
  }

  setBusy(form, true);
  showMessage(appointmentStatus, 'Enviando seu pedido…');
  const { error } = await supabaseClient.from('appointments').insert({
    service: String(values.get('service')),
    requested_date: requestedDate,
    requested_time: String(values.get('time')),
    notes: String(values.get('notes')).trim()
  });
  setBusy(form, false);

  if (error) {
    showMessage(appointmentStatus, error.code === '42501'
      ? 'O acesso ao banco ainda não está configurado. Peça ao responsável pelo site para conferir as regras de acesso.'
      : 'Não foi possível enviar agora. Confira a conexão e tente novamente.');
    return;
  }

  form.reset();
  configureDateMinimum();
  showMessage(appointmentStatus, 'Pedido enviado! Ele ficará aguardando a confirmação da Sara.');
  await loadAppointments();
});

document.querySelector('#signOut').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) showMessage(appointmentStatus, 'Não foi possível sair agora. Tente novamente.');
});

const config = window.SARA_SUPABASE_CONFIG || {};
if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
  document.querySelectorAll('#loginForm input, #signupForm input, #recoveryForm input, #newPasswordForm input, #appointmentForm input, #appointmentForm select, #appointmentForm textarea, #authCard button').forEach((field) => {
    if (!field.matches('.auth-abas button, #backToLogin')) field.disabled = true;
  });
  showMessage(authStatus, 'Estamos preparando esta área. Falta conectar o projeto Supabase e executar o schema de segurança.');
} else {
  supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecoveryPanel();
      return;
    }
    if (recoveryFlow) return;
    window.setTimeout(() => showDashboard(session), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) showMessage(authStatus, 'Não foi possível verificar sua sessão. Atualize a página e tente novamente.');
    showDashboard(data?.session);
  });
}
