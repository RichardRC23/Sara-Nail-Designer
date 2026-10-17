const topo = document.querySelector('.topo');
const menuBotao = document.querySelector('.menu-botao');
const menu = document.querySelector('.menu');

const alternarMenu = (aberto) => {
  menu.classList.toggle('aberto', aberto);
  menuBotao.setAttribute('aria-expanded', String(aberto));
};

menuBotao.addEventListener('click', () => alternarMenu(!menu.classList.contains('aberto')));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => alternarMenu(false)));
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

document.querySelectorAll('[data-mood]').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelector('[name="detalhes"]').value = `Gostei do estilo ${card.dataset.mood} e quero explorar uma ideia nessa linha.`;
    document.querySelector('#agendamento').scrollIntoView({ behavior: 'smooth' });
  });
});

document.querySelector('#formulario').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = new FormData(evento.currentTarget);
  const nome = String(dados.get('nome')).trim();
  const servico = String(dados.get('servico'));
  const detalhes = String(dados.get('detalhes')).trim();
  const mensagem = `Oi, Sara! Meu nome é ${nome} e tenho interesse em ${servico}.${detalhes ? ` Minha ideia: ${detalhes}` : ''} Podemos conversar sobre os detalhes e horários disponíveis?`;
  const status = document.querySelector('#status');
  try {
    await navigator.clipboard.writeText(mensagem);
    status.textContent = 'Pedido copiado! Agora é só colar e enviar para a Sara.';
  } catch {
    status.textContent = mensagem;
  }
});

document.querySelector('#ano').textContent = new Date().getFullYear();
