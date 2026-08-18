<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Projeto de estudos do curso de <strong>NestJS</strong> da <a href="https://www.rocketseat.com.br/" target="_blank">Rocketseat</a>.</p>

## Sobre

Este é um projeto de aprendizado, desenvolvido enquanto acompanho o curso de NestJS da Rocketseat. Ainda estou aprendendo — o objetivo é praticar conceitos como injeção de dependência, Clean Architecture (domínio, aplicação e infraestrutura separados), autenticação com JWT, validação com Zod e persistência de dados com Prisma + PostgreSQL.

Anotações e explicações dos conceitos estudados ficam em [anotacoes/](./anotacoes) e em [TUTORIAL.md](./TUTORIAL.md).

## Stack

- [NestJS](https://nestjs.com/)
- [Prisma ORM](https://www.prisma.io/) + PostgreSQL
- [Zod](https://zod.dev/) para validação
- JWT (@nestjs/jwt + passport-jwt) para autenticação
- [Vitest](https://vitest.dev/) para testes unitários e e2e
- Docker (banco de dados local via docker-compose.yml)

## O que já foi desenvolvido

- **Configuração inicial** do projeto NestJS (módulos, estrutura de pastas)
- **Banco de dados**: PostgreSQL via docker-compose, integrado com Prisma ORM
- **Cadastro de usuário**: rota `POST /accounts`
- **Validação e segurança**: validação de requisições com Zod (`ZodValidationPipe` reutilizável) e hash de senha com bcryptjs
- **Autenticação JWT**: `AuthModule` com estratégia JWT (passport-jwt), `JwtAuthGuard` para proteger rotas e decorator `CurrentUser` para extrair o usuário autenticado
- **Perguntas (Questions)**: API tipo fórum, com rotas protegidas por autenticação
  - `POST /questions` — cria pergunta vinculada ao usuário logado, gerando slug a partir do título
  - `GET` — lista perguntas recentes
- **Clean Architecture**: código separado em três camadas (`core`, `domain` e `infra`), com entidades e use cases de domínio testáveis sem depender do NestJS ou do banco de dados
- **Testes e2e**: cobertura das rotas com Vitest, usando banco de dados isolado para os testes
- **Documentação de estudo**: anotações sobre os conceitos aprendidos em [anotacoes/](./anotacoes), começando por injeção de dependência (SOLID), e um roteiro passo a passo em [TUTORIAL.md](./TUTORIAL.md)

## Como rodar o projeto

### 1. Instalar dependências

```bash
yarn install
```

### 2. Subir o banco de dados

```bash
docker-compose up -d
```

### 3. Configurar variáveis de ambiente

Copie o `.env` de exemplo (se houver) ou configure `DATABASE_URL`, `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY` conforme o `src/infra/env.ts`.

### 4. Rodar as migrations do Prisma

```bash
yarn prisma migrate dev
```

### 5. Iniciar a aplicação

```bash
# modo desenvolvimento (watch)
yarn start:dev

# modo produção
yarn start:prod
```

## Testes

```bash
# testes unitários
yarn test

# testes e2e
yarn test:e2e

# cobertura de testes
yarn test:cov
```

## Recursos do NestJS

- [Documentação oficial](https://docs.nestjs.com)
- [Cursos oficiais](https://courses.nestjs.com/)
- [Discord](https://discord.gg/G7Qnnhy)
