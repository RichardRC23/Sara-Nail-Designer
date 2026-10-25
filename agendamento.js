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
const customerTabs = [...document.querySelectorAll('.cliente-aba')];
const customerAccountName = document.querySelector('#customerAccountName');
const customerAccountInitial = document.querySelector('#customerAccountInitial');
const customerAccountPhoto = document.querySelector('#customerAccountPhoto');
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
  ['alongamento', 'Alongamento'],
  ['banho-gel', 'Banho de gel'],
  ['molde-f1', 'Molde F1'],
  ['gel-tips', 'Gel na tips'],
  ['postica-realista', 'Postiça realista'],
  ['manutencao-molde-f1', 'Manutenção — Molde F1'],
  ['manutencao-gel-tips', 'Manutenção — Gel na tips'],
  ['manutencao-banho-gel', 'Manutenção — Banho de gel']
]);
const requestedService = serviceFromQuery.get(new URLSearchParams(window.location.search).get('servico'));
if (requestedService) document.querySelector('#service').value = requestedService;
configureDateMinimum();

const showDashboard = (session) => {
  const user = session?.user;
  authCard.hidden = Boolean(user);
  dashboard.hidden = !user;
  if (!user) {
    customerAccountName.textContent = 'Área da cliente';
    customerAccountInitial.textContent = '♡';
    customerAccountPhoto.hidden = true;
    customerAccountInitial.hidden = false;
    return;
  }

  const metadataName = user.user_metadata?.full_name;
  const fallbackName = user.email?.split('@')[0] || 'que bom ver você';
  customerAccountName.textContent = (metadataName || fallbackName).split(' ')[0];
  customerAccountInitial.textContent = (metadataName || fallbackName).trim().charAt(0).toUpperCase();
  customerAccountPhoto.hidden = true;
  customerAccountInitial.hidden = false;
  document.querySelector('#customerName').textContent = metadataName || fallbackName;
  document.querySelector('#customerEmail').textContent = user.email || '';
  document.querySelector('#profileName').value = metadataName || '';
  document.querySelector('#profileEmail').value = user.email || '';
  void loadProfilePhoto(user);
  void loadAppointments();
};

const selectCustomerPanel = (panelId) => {
  customerTabs.forEach((tab) => {
    const selected = tab.getAttribute('aria-controls') === panelId;
    tab.setAttribute('aria-selected', String(selected));
    document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
  });
};
customerTabs.forEach((tab) => tab.addEventListener('click', () => selectCustomerPanel(tab.getAttribute('aria-controls'))));

async function loadProfilePhoto(user) {
  const avatar = document.querySelector('#customerAvatar');
  const path = user.user_metadata?.avatar_path;
  avatar.textContent = (user.user_metadata?.full_name || user.email || 'S').trim().charAt(0).toUpperCase();
  avatar.classList.remove('com-foto');
  avatar.style.removeProperty('--avatar-foto');
  if (!path) return;
  const { data, error } = await supabaseClient.storage.from('sara-avatars').createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return;
  avatar.style.setProperty('--avatar-foto', `url("${data.signedUrl}")`);
  avatar.classList.add('com-foto');
  if (customerAccountPhoto) {
    customerAccountPhoto.onload = () => {
      customerAccountPhoto.hidden = false;
      customerAccountInitial.hidden = true;
    };
    customerAccountPhoto.onerror = () => {
      customerAccountPhoto.hidden = true;
      customerAccountInitial.hidden = false;
    };
    customerAccountPhoto.src = data.signedUrl;
  }
}

document.querySelector('#profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const name = String(values.get('name')).trim();
  const email = String(values.get('email')).trim();
  setBusy(form, true);
  showMessage(document.querySelector('#profileStatus'), 'Salvando suas informações…');
  const { data, error } = await supabaseClient.auth.updateUser({ email, data: { full_name: name } });
  setBusy(form, false);
  if (error) {
    showMessage(document.querySelector('#profileStatus'), friendlyAuthError(error));
    return;
  }
  const updatedUser = data.user;
  document.querySelector('#customerName').textContent = updatedUser.user_metadata?.full_name || name;
  document.querySelector('#customerEmail').textContent = updatedUser.email || email;
  document.querySelector('#profileName').value = updatedUser.user_metadata?.full_name || name;
  document.querySelector('#profileEmail').value = updatedUser.email || email;
  showMessage(document.querySelector('#profileStatus'), updatedUser.new_email
    ? 'Nome atualizado. Para concluir a troca do email, confirme a mensagem enviada pelo Supabase.'
    : 'Seus dados foram atualizados com sucesso.');
});

document.querySelector('#profilePasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const password = String(values.get('password'));
  if (password !== String(values.get('passwordConfirm'))) {
    showMessage(document.querySelector('#passwordStatus'), 'As senhas não são iguais. Confira e tente novamente.');
    return;
  }
  setBusy(form, true);
  showMessage(document.querySelector('#passwordStatus'), 'Atualizando sua senha…');
  const { error } = await supabaseClient.auth.updateUser({ password });
  setBusy(form, false);
  if (error) {
    showMessage(document.querySelector('#passwordStatus'), friendlyAuthError(error));
    return;
  }
  form.reset();
  showMessage(document.querySelector('#passwordStatus'), 'Senha atualizada com sucesso.');
});

const photoInput = document.querySelector('#profilePhoto');
const cropDialog = document.querySelector('#photoCropDialog');
const cropCanvas = document.querySelector('#photoCropCanvas');
const cropContext = cropCanvas.getContext('2d');
const zoomInput = document.querySelector('#photoZoom');
let cropImage;
let cropZoom = 1;
let cropOffset = { x: 0, y: 0 };
let dragStart;

const drawPhotoCrop = () => {
  if (!cropImage) return;
  const size = cropCanvas.width;
  const scale = Math.max(size / cropImage.width, size / cropImage.height) * cropZoom;
  const width = cropImage.width * scale;
  const height = cropImage.height * scale;
  const minX = size - width;
  const minY = size - height;
  cropOffset.x = Math.min(0, Math.max(minX, cropOffset.x));
  cropOffset.y = Math.min(0, Math.max(minY, cropOffset.y));
  cropContext.clearRect(0, 0, size, size);
  cropContext.drawImage(cropImage, cropOffset.x, cropOffset.y, width, height);
};

photoInput.addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const status = document.querySelector('#photoStatus');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showMessage(status, 'Escolha uma imagem JPG, PNG ou WebP.');
    photoInput.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showMessage(status, 'A imagem precisa ter até 10 MB.');
    photoInput.value = '';
    return;
  }
  try {
    cropImage = await createImageBitmap(file);
    cropZoom = 1;
    zoomInput.value = '1';
    cropOffset = { x: 0, y: 0 };
    drawPhotoCrop();
    showMessage(status, '');
    cropDialog.showModal();
  } catch {
    showMessage(status, 'Não conseguimos abrir essa imagem. Escolha outro arquivo e tente novamente.');
    photoInput.value = '';
  }
});

zoomInput.addEventListener('input', () => {
  const previousZoom = cropZoom;
  cropZoom = Number(zoomInput.value);
  if (cropImage && previousZoom) {
    const ratio = cropZoom / previousZoom;
    const center = cropCanvas.width / 2;
    cropOffset.x = center - (center - cropOffset.x) * ratio;
    cropOffset.y = center - (center - cropOffset.y) * ratio;
  }
  drawPhotoCrop();
});

cropCanvas.addEventListener('pointerdown', (event) => {
  dragStart = { x: event.clientX, y: event.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
  cropCanvas.setPointerCapture(event.pointerId);
});
cropCanvas.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  const scaleX = cropCanvas.width / cropCanvas.getBoundingClientRect().width;
  const scaleY = cropCanvas.height / cropCanvas.getBoundingClientRect().height;
  cropOffset.x = dragStart.offsetX + (event.clientX - dragStart.x) * scaleX;
  cropOffset.y = dragStart.offsetY + (event.clientY - dragStart.y) * scaleY;
  drawPhotoCrop();
});
cropCanvas.addEventListener('pointerup', () => { dragStart = null; });
cropCanvas.addEventListener('pointercancel', () => { dragStart = null; });

const closePhotoCrop = () => {
  cropDialog.close();
  cropImage?.close?.();
  cropImage = null;
  photoInput.value = '';
};
document.querySelector('#cancelPhotoCrop').addEventListener('click', closePhotoCrop);
document.querySelector('#closePhotoCrop').addEventListener('click', closePhotoCrop);
cropDialog.addEventListener('close', () => {
  cropImage?.close?.();
  cropImage = null;
  photoInput.value = '';
});

document.querySelector('#savePhotoCrop').addEventListener('click', async () => {
  const saveButton = document.querySelector('#savePhotoCrop');
  const status = document.querySelector('#photoStatus');
  saveButton.disabled = true;
  saveButton.setAttribute('aria-busy', 'true');
  showMessage(status, 'Preparando sua foto…');
  cropCanvas.toBlob(async (blob) => {
    if (!blob) {
      showMessage(status, 'Não conseguimos preparar essa imagem. Tente escolher outra.');
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      return;
    }
    if (blob.size > 3 * 1024 * 1024) {
      showMessage(status, 'Essa imagem ficou muito grande. Diminua o zoom ou escolha outra foto.');
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      return;
    }
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      showMessage(status, 'Sua sessão expirou. Entre novamente para atualizar a foto.');
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      return;
    }
    const path = `${user.id}/perfil-${Date.now()}.jpg`;
    const { error: uploadError } = await supabaseClient.storage.from('sara-avatars').upload(path, blob, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: false
    });
    if (uploadError) {
      const detail = String(uploadError.message || '').toLowerCase();
      if (detail.includes('row-level security') || detail.includes('bucket not found') || uploadError.statusCode === '404') {
        showMessage(status, 'O espaço seguro das fotos ainda não foi criado. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase e tente novamente.');
      } else if (detail.includes('payload too large') || uploadError.statusCode === '413') {
        showMessage(status, 'A foto ficou acima do limite permitido. Diminua o zoom e tente novamente.');
      } else {
        showMessage(status, `Não foi possível enviar a foto: ${uploadError.message || 'verifique a conexão e as permissões do Supabase.'}`);
      }
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      return;
    }
    const { data, error } = await supabaseClient.auth.updateUser({ data: { avatar_path: path } });
    if (error) {
      showMessage(status, 'A foto foi enviada, mas não conseguimos vinculá-la ao perfil. Tente novamente.');
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      return;
    }
    await loadProfilePhoto(data.user);
    showMessage(status, 'Foto de perfil atualizada!');
    saveButton.disabled = false;
    saveButton.removeAttribute('aria-busy');
    closePhotoCrop();
  }, 'image/jpeg', 0.9);
});

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
  showMessage(authStatus, 'Esta área ainda não está conectada. Configure a URL e a chave pública do projeto em supabase-config.js e execute supabase/schema.sql no painel do Supabase.');
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
