# Tutorial — Construindo o nest-clean do zero

Este arquivo é um roteiro passo a passo de tudo que foi feito neste projeto, na ordem em que aconteceu. A ideia é que, ao clonar o projeto de novo, você siga esse roteiro e eu (Claude) sirva de "professor", explicando cada decisão antes de você escrever o código.

> Baseado no curso de Clean Architecture com NestJS (estilo Rocketseat Ignite).

---

## Aula 0 — Setup inicial

**Commit:** `chore: configuracao inicial do projeto NestJS`

- Criado o projeto com o Nest CLI (`nest new`).
- Instaladas as libs de teste: `vitest`, `@vitest/coverage-v8`.
- Configurado `eslint` + `@rocketseat/eslint-config`.

```bash
npm i -g @nestjs/cli
nest new nest-clean
```

---

## Aula 1 — Banco de dados com Docker + Prisma

**Commit:** `feat: configura Postgres via Docker e Prisma ORM`

- Subimos um Postgres local via `docker-compose.yml`.
- Instalado e inicializado o Prisma:

```bash
npm i prisma -D
npm i @prisma/client
npx prisma init
```

- Criado `src/prisma/prisma.service.ts` (na época ainda na raiz de `src`, sem separação de camadas):

```ts
@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  onModuleInit() {
    return this.$connect()
  }

  onModuleDestroy() {
    return this.$disconnect()
  }
}
```

**Por quê estender `PrismaClient`?** Assim `PrismaService` já tem todos os métodos (`user.create`, `question.findMany`, etc.) automaticamente. `OnModuleInit`/`OnModuleDestroy` são "ganchos de ciclo de vida" do Nest: conecta no banco quando o módulo sobe, desconecta quando a aplicação encerra.

---

## Aula 2 — Primeira rota: `POST /accounts`

**Commit:** `feat: adiciona rota POST /accounts para criar usuario`

Rota mais simples do projeto — sem autenticação, só validação + persistência. Conceitos introduzidos aqui:

### 2.1 Validação com Zod + Pipe customizado

```ts
const createAccountBodySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
})
```

```ts
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value)
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({ errors: fromZodError(error), message: 'Validation failed', statusCode: 400 })
      }
      throw new BadRequestException('Validation failed')
    }
  }
}
```

Um **Pipe** intercepta o dado antes de chegar no controller: valida ou transforma, e se falhar, corta a requisição com `400`.

### 2.2 Decorators do controller

```ts
@Controller('/accounts')
export class CreateAccountController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createAccountBodySchema))
  async handle(@Body() body: CreateAccountBodySchema) {
    // ...
  }
}
```

| Decorator | Papel |
|---|---|
| `@Controller('/accounts')` | prefixo de rota da classe inteira |
| `@Post()` | define o verbo HTTP do método |
| `@HttpCode(201)` | status de sucesso (padrão criação = 201) |
| `@UsePipes(...)` | valida o body inteiro antes do método rodar |
| `@Body()` | injeta o corpo (já validado) no parâmetro |

`handle` é só o nome do método — não tem nenhum efeito mágico, poderia se chamar qualquer coisa. O que registra a rota é o `@Post()`.

### 2.3 Regra de negócio (ainda dentro do controller nessa fase)

```ts
const userWithSameEmail = await this.prisma.user.findUnique({ where: { email } })
if (userWithSameEmail) throw new ConflictException('...')

const hashPassword = await hash(password, 8) // bcryptjs — nunca salvar senha em texto puro
await this.prisma.user.create({ data: { name, email, password: hashPassword } })
```

---

## Aula 3 — Anotações sobre Injeção de Dependência

**Commit:** `docs: adiciona anotacoes sobre injecao de dependencia`

Conceito chave do Nest: você nunca faz `new PrismaService()`. Só declara no construtor:

```ts
constructor(private prisma: PrismaService) {}
```

O Nest resolve sozinho, desde que `PrismaService` esteja registrado em algum `providers: [...]` de um módulo importado. `private prisma: ...` é um atalho do TypeScript que já cria `this.prisma = prisma`.

---

## Aula 4 — Autenticação JWT + rota de criar pergunta

**Commit:** `feat: adiciona autenticacao JWT e rota de criacao de perguntas`

Peças novas, todas conectadas entre si:

### 4.1 `AuthModule` — registra o JWT com par de chaves RS256

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  global: true,
  useFactory(config: ConfigService<Env, true>) {
    const privateKey = config.get('JWT_PRIVATE_KEY', { infer: true })
    const publicKey = config.get('JWT_PUBLIC_KEY', { infer: true })
    return {
      signOptions: { algorithm: 'RS256' },
      privateKey: Buffer.from(privateKey, 'base64'),
      publicKey: Buffer.from(publicKey, 'base64'),
    }
  },
})
```

Chave privada assina o token (usada no login), chave pública verifica a assinatura (usada em toda rota protegida).

### 4.2 `AuthenticateController` — gera o token no login

```ts
const user = await this.prisma.user.findUnique({ where: { email } })
if (!user) throw new UnauthorizedException(...)

const isPasswordValid = await compare(password, user.password)
if (!isPasswordValid) throw new UnauthorizedException(...)

const accessToken = this.jwt.sign({ sub: user.id })
return { access_token: accessToken }
```

### 4.3 `JwtStrategy` — a "receita" de validação chamada `'jwt'`

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    const publicKey = config.get('JWT_PUBLIC_KEY', { infer: true })
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: Buffer.from(publicKey, 'base64'),
      algorithms: ['RS256'],
    })
  }

  async validate(payload: UserPayload) {
    return tokenPayloadSchema.parse(payload) // o retorno vira request.user
  }
}
```

### 4.4 `JwtAuthGuard` — trava a porta da rota

```ts
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Casca vazia em cima de `AuthGuard('jwt')` — o nome `'jwt'` conecta com a `JwtStrategy` acima.

### 4.5 `CurrentUser` — lê o que a strategy colocou em `request.user`

```ts
export const CurrentUser = createParamDecorator((_, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest()
  return request.user as UserPayload
})
```

### 4.6 Encadeando tudo em `CreateQuestionController`

```ts
@Controller('/questions')
@UseGuards(JwtAuthGuard)
export class CreateQuestionController {
  @Post()
  async handle(
    @Body(bodyValidationPipe) body: createQuestionBodySchema,
    @CurrentUser() user: UserPayload,
  ) {
    const { sub: userId } = user
    // ...
  }
}
```

**Linha do tempo de uma requisição autenticada:**

```
Requisição
   │
   ▼
JwtAuthGuard ──chama──▶ JwtStrategy.validate() ──preenche──▶ request.user
   │ (token inválido → 401, para aqui)
   ▼
ZodValidationPipe.transform() ──valida──▶ body
   │ (schema não bate → 400, para aqui)
   ▼
Controller.handle()
   │ @CurrentUser() lê request.user
   ▼
PrismaService ──▶ banco de dados
```

---

## Aula 5 — Testes E2E com Vitest + banco isolado

**Commit:** `test: adiciona testes e2e com Vitest e configuracao de banco isolado`

- Configurado `vitest.config.e2e.ts` separado do config unitário.
- Cada teste e2e roda contra um **schema Postgres isolado** (gerado por teste), pra não conflitar entre execuções paralelas.
- Criados `*.e2e-spec.ts` ao lado de cada controller, testando a rota real via `supertest`.

---

## Aula 6 — Ajustes de qualidade (feitos nesta sessão)

Depois do curso seguido até aqui, fizemos uma limpeza:

1. **`SpyInstance` → `MockInstance`**: o Vitest v4 removeu `SpyInstance` do pacote. Em `on-answer-created.spec.ts` e `on-question-best-answer-chosen.spec.ts`, trocamos a tipagem do spy:
   ```ts
   // antes (Vitest 3-)
   let spy: SpyInstance<[Request], Promise<Response>>
   // depois (Vitest 4+)
   let spy: MockInstance<(request: Request) => Promise<Response>>
   ```

2. **`Either<Error, {}>` → `Either<Error, null>`**: nos use-cases de delete (`delete-question-comment`, `delete-answer-comment`, `delete-answer`), o retorno de sucesso usava um objeto vazio `{}` sem significado. Padronizamos para `null` (igual já estava em `delete-question.ts`), já que a operação não devolve nenhum dado — só indica sucesso.

3. **`any` → `unknown`**: em `src/core/entities/entity.ts` (`equals(entity: Entity<unknown>)`) e `src/core/events/domain-events.ts` (`AggregateRoot<unknown>`, `DomainEventCallback = (event: unknown) => void`). `any` desliga a checagem de tipos; `unknown` obriga a validar antes de usar — mais seguro, sem perder flexibilidade genérica.

---

## Aula 7 — Criando a camada de infraestrutura (`src/infra`)

Esse foi o passo mais importante: **separar regra de negócio pura de tudo que depende de framework/banco**.

### 7.1 Por que separar?

Antes, tudo vivia solto em `src/`: `auth/`, `controllers/`, `pipes/`, `prisma/`, misturado com a lógica de negócio dentro dos próprios controllers. Isso trava os testes unitários — testar "gerar slug" exigia subir Nest + Postgres.

### 7.2 A nova estrutura de 3 camadas

```
src/
  core/         → utilitários sem nenhuma dependência de negócio ou framework
                  (Either, Entity, AggregateRoot, DomainEvents, erros base)

  domain/       → regra de negócio pura, testável sem Nest e sem banco
    forum/
      enterprise/
        entities/           → Question, Answer, Comment, Slug, eventos de domínio
      application/
        use-cases/          → CreateQuestion, DeleteAnswer, EditQuestion...
        repositories/       → INTERFACES (contratos), ex: QuestionsRepository
    notification/
      enterprise/entities/
      application/{use-cases,subscribers,repositories}

  infra/        → tudo que fala com o mundo externo (Nest, Prisma, JWT)
    auth/                    → AuthModule, JwtStrategy, JwtAuthGuard, CurrentUser
    database/
      prisma/
        prisma.service.ts
        repositories/        → IMPLEMENTAÇÕES concretas das interfaces do domain
      database.module.ts
    http/
      controllers/           → os *.controller.ts que antes ficavam soltos
      pipes/                 → ZodValidationPipe
      http.module.ts
    env.ts
    app.module.ts
    main.ts
```

### 7.3 A regra de ouro

> `domain` nunca importa nada de `infra`. `infra` pode importar de `domain`.

As **interfaces** de repositório moram no domain:

```ts
// src/domain/forum/application/repositories/questions-repository.ts
export interface QuestionsRepository {
  findById(id: string): Promise<Question | null>
  create(question: Question): Promise<void>
  // ...
}
```

As **implementações** moram no infra, implementando essas interfaces:

```ts
// src/infra/database/prisma/repositories/prisma-questions-repository.ts
export class PrismaQuestionsRepository implements QuestionsRepository {
  async findById(id: string) {
    // usa this.prisma.question.findUnique(...) aqui
  }
  // ...
}
```

Um use-case do domain recebe a **interface** no construtor, nunca a implementação concreta:

```ts
export class DeleteQuestionUseCase {
  constructor(private questionsRepository: QuestionsRepository) {} // interface!
}
```

Isso permite testar o use-case com um repositório **em memória** (`InMemoryQuestionsRepository`, em `test/repositories/`), sem tocar no Postgres. Em produção, o `DatabaseModule` é quem "liga o fio": diz ao Nest "quando alguém pedir `QuestionsRepository`, entregue uma instância de `PrismaQuestionsRepository`".

### 7.4 Movendo os arquivos existentes

- `src/prisma/prisma.service.ts` → `src/infra/database/prisma/prisma.service.ts`
- `src/auth/*` → `src/infra/auth/*`
- `src/controllers/*` → `src/infra/http/controllers/*`
- `src/pipes/*` → `src/infra/http/pipes/*`
- `src/env.ts` → `src/infra/env.ts`
- `src/app.module.ts` → `src/infra/app.module.ts`
- `src/main.ts` → `src/infra/main.ts`

⚠️ **Cuidado ao mover `main.ts`:** como ele passou a morar **dentro** de `src/infra`, os imports relativos não podem mais ter o prefixo `./infra/...` — isso duplicava o caminho e quebrava a build:
```ts
// ERRADO (bug que corrigimos nesta sessão)
import { AppModule } from './infra/app.module'
import { Env } from './infra/env'

// CERTO
import { AppModule } from './app.module'
import { Env } from './env'
```

### 7.5 Os módulos do Nest "colando" tudo junto

```ts
// database.module.ts
@Module({
  providers: [PrismaService],
})
export class DatabaseModule {}
```

```ts
// http.module.ts
@Module({
  imports: [DatabaseModule],
  controllers: [CreateAccountController, AuthenticateController, ...],
  providers: [PrismaService],
})
export class HttpModule {}
```

```ts
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ validate: (env) => envSchema.parse(env), isGlobal: true }),
    AuthModule,
    HttpModule,
  ],
})
export class AppModule {}
```

> 📌 Ponto de atenção pra próxima aula: hoje `PrismaService` está registrado tanto em `DatabaseModule` quanto em `HttpModule` (duplicado) — vale revisar se `HttpModule` deveria só **importar** `DatabaseModule` e reexportar, em vez de registrar `PrismaService` de novo.

### 7.6 Criando os repositórios Prisma (stubs)

Criamos os arquivos vazios em `src/infra/database/prisma/repositories/`, um pra cada interface do domain, para implementar durante as próximas aulas:

- `prisma-questions-repository.ts` ↔ `QuestionsRepository`
- `prisma-question-comments-repository.ts` ↔ `QuestionCommentsRepository`
- `prisma-question-attachments-repository.ts` ↔ `QuestionAttachmentsRepository`
- `prisma-answers-repository.ts` ↔ `AnswersRepository`
- `prisma-answer-comments-repository.ts` ↔ `AnswerCommentsRepository`
- `prisma-answer-attachments-repository.ts` ↔ `AnswerAttachmentsRepository`

Cada um vai precisar de um **mapper** (`toDomain` / `toPrisma`) pra converter entre o formato do Prisma (linhas de banco) e as entidades de domínio (`Question`, `Answer`, etc.) — assunto da próxima aula.

---

## Checklist para refazer do zero

- [ ] Aula 0 — `nest new` + eslint + vitest
- [ ] Aula 1 — Docker Postgres + Prisma init + `PrismaService`
- [ ] Aula 2 — `POST /accounts` com Zod Pipe + bcrypt
- [ ] Aula 3 — Entender injeção de dependência
- [ ] Aula 4 — JWT: `AuthModule`, `JwtStrategy`, `JwtAuthGuard`, `CurrentUser`, `POST /questions`
- [ ] Aula 5 — Testes e2e com Vitest + schema isolado por teste
- [ ] Aula 6 — `SpyInstance`→`MockInstance`, `{}`→`null`, `any`→`unknown`
- [ ] Aula 7 — Separar em `core` / `domain` / `infra`, mover arquivos, corrigir imports do `main.ts`, criar repositórios Prisma
- [ ] Aula 8 (próxima) — Implementar os repositórios Prisma de fato + mappers Prisma ↔ domínio

---

*Este arquivo deve ser atualizado a cada nova "aula"/etapa do projeto — é o guia que vamos seguir ao refazer o projeto do zero.*
