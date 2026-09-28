# 📚 BiblioGest

Sistema de Gestão de Bibliotecas — Open Source, simples e funcional.

Construído com **Next.js 14+ (App Router)**, **TypeScript**, **Prisma ORM** e **PostgreSQL**. Padrões de catalogação **MARC 21** e **RDA**. Deploy gratuito na **Vercel**.

---

## 🎯 Objetivo

Desenvolver um sistema de gestão de bibliotecas funcional, focado nas operações diárias — catalogação, empréstimos, controle de estoque, geração de etiquetas e relatórios — com suporte a padrões MARC 21 e RDA.

---

## ✨ Funcionalidades Principais

### 🔐 Autenticação e Gestão de Usuários
- Login com e-mail + senha + proteção anti-bot
- Três perfis: **Administrador**, **Bibliotecário**, **Assistente**
- Limite de 5 tentativas → bloqueio temporário de 15 minutos
- Recuperação de senha e controle de sessão

### 📖 Catalogação (MARC 21 + RDA)
- Campos principais para **Livros** (MARC 245, 100, 700, 260, 250, 020, 650, 082)
- Campos principais para **Periódicos** (MARC 245, 022, 260, 362, 650, 082)
- **Campos MARC extras personalizáveis** — adicione quantos campos precisar (300, 500, 510, etc.)
- Busca em todos os campos incluindo personalizados
- Edição e exclusão (apenas administrador)

### 📦 Exemplares e Controle de Estoque
- Múltiplos exemplares por título catalogado
- Códigos de barras únicos para cada exemplar
- Status: ✅ Disponível | 📖 Emprestado | 🔧 Em manutenção | ❌ Perdido
- Atualização automática de status

### 🧾 Empréstimos, Devoluções e Leitores
- Cadastro completo de leitores (nome, CPF, contato, endereço)
- Registro de empréstimo com data de devolução prevista
- Renovação simples (máximo 3 renovações)
- Bloqueio automático para leitores com atraso
- Histórico de empréstimos por leitor e exemplar

### 🏷️ Geração de Etiquetas
- **Etiqueta de Lombada** (20×50mm) — Número de chamada + Cutter + Número do exemplar
- **Etiqueta de Identificação** (30×70mm) — Informação completa
- Seleção de um ou vários exemplares para geração em lote
- Visualização antes de imprimir + exportação PDF

### 📊 Relatórios Principais
- Circulação: empréstimos ativos, histórico, devoluções em atraso
- Acervo: total de títulos, exemplares, disponíveis × emprestados
- Empréstimos por período
- Exportação em CSV

### 🔍 Catálogo Público
- Acesso livre, sem login
- Busca simples e avançada (título, autor, ISBN, assunto, ano)
- Visualização de detalhes e disponibilidade
- Interface limpa e responsiva

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| **Next.js 14+** | Framework principal (App Router) |
| **TypeScript** | Tipagem estática |
| **Prisma ORM** | Camada de banco de dados |
| **PostgreSQL** | Banco de dados (Neon, Supabase, Vercel Postgres) |
| **Tailwind CSS** | Estilização |
| **JWT** | Autenticação |
| **bcryptjs** | Hash de senhas |
| **date-fns** | Manipulação de datas |
| **pdf-lib** | Geração de etiquetas em PDF |

---

## 🔑 Primeiro Acesso (Inicialização)

O sistema inicia **vazio**. Para criar o primeiro administrador:

### Opção 1: Via linha de comando (recomendado)

```bash
# Criar admin com credenciais padrão
npx tsx prisma/create-admin.ts

# Ou com credenciais personalizadas
npx tsx prisma/create-admin.ts nome@email.com senha123 "Nome Completo"
```

### Opção 2: Via Prisma Studio

```bash
npx prisma db push
npx prisma studio
```
Crie um usuário manualmente na aba **User** com:
- **name**: Administrador
- **email**: admin@bibliogest.local
- **password**: (use o bcrypt para gerar o hash)
- **role**: ADMIN

### Credenciais padrão (se usar o script):

```
E-mail: admin@bibliogest.local
Senha: admin123
```

### Após criar o primeiro admin:
1. Acesse `http://localhost:3000/auth/login`
2. Faça login com o admin
3. No painel → **Usuários** → **Cadastrar** para criar bibliotecários e assistentes

---

## 📋 Pré-requisitos

- **Node.js** v18+ ([instalar](https://nodejs.org/))
- **npm** ou **yarn**
- **PostgreSQL** (local ou serviço em nuvem)

---

## 🚀 Instalação Local

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/bibliogest.git
cd bibliogest
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e edite:

```bash
cp .env.example .env
```

Edite o `.env` com seus dados:

```env
DATABASE_URL="postgresql://USER:SENHA@HOST:5432/bibliogest"
JWT_SECRET="sua-chave-secreta-super-segura"
JWT_EXPIRES_IN="7d"
NEXT_PUBLIC_URL="http://localhost:3000"
```

### 4. Criar o banco de dados

```bash
# Com PostgreSQL local:
createdb bibliogest

# Ou no Neon/Supabase, crie o banco e use a URL de conexão
```

### 5. Executar migrações do Prisma

```bash
# Sincronizar o schema com o banco de dados
npx prisma db push

# Ou usar migrações formais
npx prisma migrate dev --name init
```

### 6. Gerar o cliente Prisma

```bash
npx prisma generate
```

### 7. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: **http://localhost:3000**

> ⚠️ **O sistema inicia vazio.** Não há dados de teste automáticos. Cadastre o primeiro administrador através da página de registro.

---

## 🛡️ Configuração do Anti-Bot (hCaptcha)

Para proteger o login contra bots automáticos, configure o **hCaptcha**:

### 1. Obter chaves do hCaptcha

1. Acesse [hcaptcha.com](https://hccaptcha.com)
2. Cadastre seu site
3. Obtenha o **Site Key** e **Secret Key**

### 2. Configurar no `.env`

```env
HCAPTCHA_SITE_KEY=seu-site-key-aqui
HCAPTCHA_SECRET_KEY=seu-secret-key-aqui
```

### 3. Em produção

Descomente o código de validação do hCaptcha em `src/app/api/auth/login/route.ts`:
```typescript
// O código já está preparado — apenas descomente as linhas indicadas
```

> 💡 **Sem captcha configurado:** O login funciona normalmente em desenvolvimento. Recomenda-se configurar o hCaptcha antes de colocar em produção.

---

## ☁️ Deploy na Vercel

### Passo 1: Criar conta na Vercel

Acesse [vercel.com](https://vercel.com) e crie uma conta gratuita.

### Passo 2: Conectar repositório

1. Importe seu projeto na Vercel
2. Selecione o framework **Next.js**
3. Configure o comando de build: `next build`
4. Comando de dev: `next dev`

### Passo 3: Configurar variáveis de ambiente

Na dashboard da Vercel, vá em **Settings → Environment Variables** e adicione:

```
DATABASE_URL = (sua URL PostgreSQL na nuvem)
JWT_SECRET = (sua chave secreta)
JWT_EXPIRES_IN = 7d
NEXT_PUBLIC_URL = (URL do seu deploy)
```

### Passo 4: Configurar PostgreSQL na nuvem

Recomendações para banco de dados gratuito:

#### **Neon.tech** (recomendado)
1. Acesse [neon.tech](https://neon.tech)
2. Crie um projeto gratuito
3. Copie a URL de conexão (`postgresql://...`)
4. Coloque no `DATABASE_URL`

#### **Supabase**
1. Acesse [supabase.com](https://supabase.com)
2. Crie um projeto gratuito
3. Vá em **Settings → Database** → copie a URL
4. Crie um usuário e senha para conexão

#### **Vercel Postgres**
1. No dashboard da Vercel, vá em **Storage → Create**
2. Selecione **Postgres**
3. Conecte automaticamente ao seu projeto

### Passo 5: Deploy

```bash
# Ou basta clicar em "Deploy" na Vercel
```

A Vercel fará o build automático e publicará sua aplicação.

---

## 📝 Configuração do PostgreSQL na Nuvem

### Neon.tech (Recomendado)

1. Acesse [neon.tech](https://neon.tech) e crie conta gratuita
2. Clique em **"Create Project"**
3. Escolha um nome (ex: `bibliogest`)
4. Selecione região e plano gratuito
5. Após criar, vá em **Connection Details**
6. Use a connection string como `DATABASE_URL`

**Exemplo de URL:**
```
postgresql://user:password@ep-namespace.saas.amazonaws.com:5432/dbname?sslmode=require
```

7. Execute as migrações:
```bash
npx prisma db push
npx prisma migrate deploy
```

---

## 📂 Estrutura do Projeto

```
bibliogest/
├── prisma/
│   └── schema.prisma        # Schema do banco de dados
├── src/
│   ├── app/
│   │   ├── dashboard/       # Páginas protegidas (login obrigatório)
│   │   │   ├── layout.tsx   # Layout com sidebar
│   │   │   ├── page.tsx     # Dashboard principal
│   │   │   ├── catalog/     # Catalogação
│   │   │   ├── exemplars/   # Exemplares
│   │   │   ├── loans/       # Empréstimos
│   │   │   ├── readers/     # Leitores
│   │   │   ├── labels/      # Etiquetas
│   │   │   ├── reports/     # Relatórios
│   │   │   └── users/       # Usuários do sistema
│   │   ├── api/             # Rotas da API (backend)
│   │   │   ├── auth/        # Login, registro, me, logout
│   │   │   ├── catalog/     # CRUD de catálogo
│   │   │   ├── exemplars/   # CRUD de exemplares
│   │   │   ├── loans/       # CRUD de empréstimos
│   │   │   ├── readers/     # CRUD de leitores
│   │   │   ├── users/       # CRUD de usuários
│   │   │   ├── reports/     # Relatórios
│   │   │   └── labels/      # Etiquetas
│   │   ├── catalog/         # Catálogo público (sem login)
│   │   ├── auth/            # Páginas de login/registro
│   │   ├── globals.css      # Estilos globais
│   │   ├── layout.tsx       # Layout root
│   │   └── page.tsx         # Página inicial
│   ├── lib/
│   │   ├── prisma.ts        # Cliente Prisma
│   │   ├── auth.ts          # Funções de autenticação JWT
│   │   └── utils.ts         # Utilitários
│   ├── types/
│   │   └── index.ts         # Tipos TypeScript
│   └── middleware.ts         # Middleware de autenticação
├── .env                     # Variáveis de ambiente
├── .env.example             # Exemplo de variáveis
├── tailwind.config.ts       # Configuração Tailwind
├── tsconfig.json            # Configuração TypeScript
├── next.config.mjs          # Configuração Next.js (standalone para Vercel)
├── package.json             # Dependências
└── README.md                # Este arquivo
```

---

## 🔒 Segurança

- Senhas com hash **bcryptjs**
- Autenticação via **JWT** com cookies `httpOnly`
- Limite de **5 tentativas** → bloqueio de **15 minutos**
- Variáveis sensíveis em `.env` (nunca commitadas)
- Proteção anti-bot será adicionada após o sistema estar funcionando

---

## 🏷️ Padrões de Catalogação

### MARC 21 Implementados
- **245**: Título principal
- **100, 700**: Autores/Responsáveis
- **250**: Edição
- **260, 264**: Editora, local, ano
- **020**: ISBN
- **022**: ISSN
- **650**: Assunto/Palavras-chave
- **082**: Classificação CDD/CDU
- **300**: Descrição física (campo extra)
- **500**: Nota geral (campo extra)
- **510**: Referência bibliográfica (campo extra)

### Código Cutter
Gerado automaticamente com base na primeira letra do autor + código numérico.

### RDA
Todos os campos seguem princípios RDA para descrição consistente de recursos bibliográficos.

---

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

MIT License — sinta-se livre para usar e contribuir!

---

## 📧 Contato

Para dúvidas, sugestões ou reportar bugs, entre em contato.

---

## 🙏 Agradecimentos

Inspirado nos sistemas open source:
- **Koha**
- **Pergamum**
- **Evergreen**
- **OpenBiblio**

Desenvolvido com ❤️ para bibliotecas.
