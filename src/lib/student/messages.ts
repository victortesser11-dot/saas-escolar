/** Mensagens para o aluno, a partir dos códigos devolvidos pelas funções do banco. */
const ENTRY_ERRORS: Record<string, string> = {
  not_found: "Não encontramos esta prova. Confira o link com o professor.",
  not_open: "A prova ainda não abriu. Aguarde o horário marcado pelo professor.",
  closed: "Esta prova já foi encerrada.",
  access_code_required: "Digite o código de acesso que o professor mostrou.",
  access_code_invalid: "Código de acesso incorreto. Confira com o professor.",
  student_not_found:
    "Você não está na lista desta turma. Confira seu nome e número ou fale com o professor.",
  name_mismatch:
    "Esse número já está com outro nome na turma. Confira seu número e digite seu primeiro nome como está na chamada.",
  invalid_student: "Confira seu nome e seu número na turma.",
  full_name_required: "Sem o número, escreva seu nome e sobrenome, como na chamada.",
  ambiguous_name:
    "Há mais de um aluno com esse nome na turma. Digite também o seu número (peça ao professor).",
  class_full: "A turma atingiu o limite de alunos. Fale com o professor.",
  too_many_attempts: "Muitas tentativas erradas. Aguarde alguns minutos ou chame o professor.",
  already_submitted: "Você já enviou esta prova.",
  interrupted: "Sua prova foi interrompida. Chame o professor para liberar.",
};

export const CONNECTION_ERROR =
  "Não foi possível conectar. Verifique a internet do celular e tente de novo.";

export function entryErrorMessage(code: string | undefined): string {
  return (code && ENTRY_ERRORS[code]) || CONNECTION_ERROR;
}
