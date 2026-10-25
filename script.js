const topo = document.querySelector('.topo');
const menuBotao = document.querySelector('.menu-botao');
const menu = document.querySelector('.menu');

const alternarMenu = (aberto) => {
  menu.classList.toggle('aberto', aberto);
  menuBotao.setAttribute('aria-expanded', String(aberto));
};

menuBotao.addEventListener('click', () => alternarMenu(!menu.classList.contains('aberto')));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => alternarMenu(false)));

const customerAccountName = document.querySelector('#customerAccountName');
const customerAccountInitial = document.querySelector('#customerAccountInitial');
const customerAccountPhoto = document.querySelector('#customerAccountPhoto');
const supabaseConfig = window.SARA_SUPABASE_CONFIG || {};
if (customerAccountName && supabaseConfig.url && supabaseConfig.publishableKey && window.supabase?.createClient) {
  const customerSupabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey);
  const updateCustomerLink = async (user) => {
    if (!user) {
      customerAccountName.textContent = 'Área da cliente';
      customerAccountInitial.textContent = 'C';
      customerAccountPhoto.hidden = true;
      return;
    }
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Minha área';
    customerAccountName.textContent = name.split(' ')[0];
    customerAccountInitial.textContent = name.trim().charAt(0).toUpperCase();
    customerAccountPhoto.hidden = true;
    const avatarPath = user.user_metadata?.avatar_path;
    if (!avatarPath) return;
    const { data, error } = await customerSupabase.storage.from('sara-avatars').createSignedUrl(avatarPath, 60 * 60);
    if (error || !data?.signedUrl) return;
    customerAccountPhoto.onload = () => {
      customerAccountPhoto.hidden = false;
      customerAccountInitial.hidden = true;
    };
    customerAccountPhoto.onerror = () => {
      customerAccountPhoto.hidden = true;
      customerAccountInitial.hidden = false;
    };
    customerAccountPhoto.src = data.signedUrl;
  };
  customerSupabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => { void updateCustomerLink(session?.user); }, 0);
  });
  customerSupabase.auth.getSession().then(({ data }) => updateCustomerLink(data?.session?.user));
}
window.addEventListener('scroll', () => topo.classList.toggle('rolou', scrollY > 12), { passive: true });

const observador = new IntersectionObserver(
  (itens) => itens.forEach((item) => item.isIntersecting && item.target.classList.add('visivel')),
  { threshold: 0.12 }
);
document.querySelectorAll('.revelar').forEach((elemento) => observador.observe(elemento));

document.querySelectorAll('[data-servico]').forEach((link) => {
  link.addEventListener('click', () => {
    const opcao = [...document.querySelectorAll('[name="servico"]')].find((radio) => radio.value === link.dataset.servico);
    if (opcao) opcao.checked = true;
  });
});

document.querySelector('#ano').textContent = new Date().getFullYear();
