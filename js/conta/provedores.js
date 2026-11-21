// Onde o progresso fica guardado. Hoje existe só o provedor "local" (este navegador, sem login).
// Login com conta AINDA NÃO EXISTE no jogo: este arquivo só define o formato que um provedor futuro terá de seguir
// (ver docs/ARQUITETURA.md, seção "Conta e login"). Nenhum provedor guarda senha: o login, quando existir,
// deve ser feito por um serviço próprio para isso (o jogo recebe só um identificador e o progresso).
import { carregar, salvar, apagar } from '../core/storage.js';

/**
 * Formato de um provedor:
 *   id          texto curto e único ('local', no futuro ex.: 'conta')
 *   nome        nome mostrado ao jogador
 *   descricao   uma frase sobre onde o progresso fica
 *   disponivel  true só quando o provedor funciona de verdade nesta versão
 *   precisaLogin  se exige entrar com uma conta
 *   carregar(ref) -> estado        lê e valida (sempre por normalizar)
 *   salvar(estado) -> boolean      grava; false se não foi possível
 *   apagar() -> boolean            remove o progresso guardado por ele
 */
export const CAMPOS_PROVEDOR = ['id', 'nome', 'descricao', 'disponivel', 'precisaLogin', 'carregar', 'salvar', 'apagar'];

export const provedorLocal = Object.freeze({
  id: 'local',
  nome: 'Neste aparelho',
  descricao: 'O progresso fica salvo só neste navegador. Para levar a outro aparelho, use a sincronização por código.',
  disponivel: true,
  precisaLogin: false,
  carregar: ref => carregar(ref),
  salvar: estado => salvar(estado),
  apagar: () => apagar()
});

/** Provedores que existem nesta versão (só os disponíveis entram aqui: nada de opção que não funciona). */
export const PROVEDORES = [provedorLocal];

/** Confere se um objeto segue o formato de provedor (usado nos testes e por quem for adicionar um novo). */
export function provedorValido(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'string' || !/^[a-z][a-z0-9-]{0,19}$/.test(p.id)) return false;
  if (typeof p.nome !== 'string' || typeof p.descricao !== 'string') return false;
  if (typeof p.disponivel !== 'boolean' || typeof p.precisaLogin !== 'boolean') return false;
  return ['carregar', 'salvar', 'apagar'].every(f => typeof p[f] === 'function');
}

/** O provedor em uso. Enquanto só existir o local, é sempre ele. */
export const provedorAtivo = () => provedorLocal;
