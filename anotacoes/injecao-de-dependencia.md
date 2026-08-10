# Injeção de Dependência no NestJS

## O ponto principal

Olha esse código:

```ts
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

Repara no que **não** tem aqui: em nenhum lugar aparece `new AppService()`.

O controller usa o serviço, mas não cria o serviço. Ele só declara no construtor "eu preciso de um `AppService`" e alguém entrega pronto. Esse "alguém" é o Nest.

É isso que o instrutor chamou de SOLID.

---

## Por que isso é SOLID

O **D** do SOLID é o *Dependency Inversion Principle* (Princípio da Inversão de Dependência).

A ideia, em português simples: **uma classe não deve ser responsável por criar aquilo de que ela depende.**

Compara as duas versões:

### Sem injeção (acoplado)

```ts
export class AppController {
  private appService = new AppService();  // ← ele mesmo cria
}
```

Aqui o controller tem **duas** responsabilidades:
1. Usar o serviço
2. Decidir como o serviço é construído

Se o `AppService` mudar de construtor, o controller quebra. Se você quiser trocar por outra implementação, tem que editar o controller. Se quiser testar sem tocar no serviço real, não dá — ele está soldado ali dentro.

### Com injeção (desacoplado)

```ts
export class AppController {
  constructor(private readonly appService: AppService) {}  // ← recebe pronto
}
```

Agora o controller só usa. A decisão de **como construir** subiu para fora dele.

Essa subida é a **inversão**: a responsabilidade foi invertida, saiu de dentro da classe e foi para quem monta a aplicação.

---

## Os três nomes que se confundem

São coisas diferentes mas parentes, e no dia a dia muita gente usa como sinônimo:

| Sigla | Nome | O que é |
|---|---|---|
| **IoC** | Inversão de Controle | Quem controla a criação do objeto não é mais a classe, é o framework |
| **DI** | Injeção de Dependência | A técnica concreta: entregar a dependência pelo construtor |
| **DIP** | Inversão de Dependência | O princípio do SOLID: depender de abstração, não de implementação |

No código acima temos **IoC** e **DI** com certeza. O **DIP completo** vem quando o tipo declarado também é uma abstração — veja a última seção.

---

## Como o Nest faz isso funcionar

São 4 peças que trabalham juntas:

### 1. O tipo do construtor vira metadado

Normalmente o TypeScript apaga os tipos ao compilar pra JavaScript. Mas o `tsconfig.json` do Nest tem:

```json
"emitDecoratorMetadata": true,
"experimentalDecorators": true
```

Com isso, em toda classe decorada (`@Controller()`, `@Injectable()`), o compilador **grava os tipos do construtor no JS gerado**. É pra isso que serve o `import 'reflect-metadata'` lá no `main.ts`.

### 2. O Nest lê esse metadado

Ao subir a aplicação, o Nest pergunta via reflection: "de que esse construtor precisa?"
Resposta gravada: `[AppService]`.

### 3. O módulo diz de onde vem

```ts
@Module({
  controllers: [AppController],
  providers: [AppService],   // ← registrado aqui
})
export class AppModule {}
```

E a classe precisa estar marcada como disponível para injeção:

```ts
@Injectable()
export class AppService { ... }
```

### 4. O container monta tudo

O Nest cria o `AppService`, guarda a instância, e passa ela para o `new AppController(...)` que **ele** executa internamente.

> **Teste rápido:** tira `AppService` do array `providers` e sobe a aplicação.
> O Nest quebra na hora com:
> `Nest can't resolve dependencies of the AppController`
> É uma forma boa de ver o container agindo.

---

## Por que vale a pena

**Singleton de graça.** O Nest cria **uma** instância e reusa em todo mundo que pedir. Se cada classe desse `new`, você teria cópias soltas — e se o serviço tiver estado, conexão de banco ou cache, isso vira bug.

**Grafos profundos resolvidos sozinhos.** Se o `AppService` depende de um `PrismaService`, que depende de uma config... você teria que instanciar tudo na mão, na ordem certa, em todo lugar que usasse. O container faz isso.

**Testes.** Como o controller não sabe de onde vem o serviço, no teste você troca por um mock sem tocar em uma linha do controller.

---

## O passo que falta (vem mais pra frente no curso)

No código atual o tipo declarado ainda é a classe **concreta**:

```ts
constructor(private readonly appService: AppService) {}
```

Para o DIP na forma estrita, o controller deveria depender de um **contrato**, não da implementação.

Em TypeScript, `interface` desaparece na compilação — então o Nest não consegue usar interface como token de injeção. O padrão usado é **classe abstrata como contrato**:

```ts
// o contrato
export abstract class AppService {
  abstract getHello(): string;
}

// a implementação
@Injectable()
export class AppServiceImpl implements AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

E o módulo amarra os dois:

```ts
@Module({
  controllers: [AppController],
  providers: [
    { provide: AppService, useClass: AppServiceImpl },
  ],
})
export class AppModule {}
```

O controller continua escrito exatamente igual, mas agora depende do contrato. Trocar a implementação é **uma linha no módulo**.

É exatamente esse padrão que vai aparecer no Clean Architecture: os casos de uso dependem de abstrações tipo `QuestionsRepository`, e o módulo decide se entrega o `PrismaQuestionsRepository` (produção) ou o `InMemoryQuestionsRepository` (testes).

---

## Resumo de uma linha

> O controller não dá `new` no serviço. Ele pede, o Nest entrega. Assim a classe para de decidir como suas dependências nascem — e é isso que desacopla.
