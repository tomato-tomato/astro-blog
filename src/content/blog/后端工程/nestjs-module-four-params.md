---
title: 'NestJS 的 @Module 到底在管什么？把四个参数一次讲清'
description: 'controllers、providers、imports、exports 常常互相打架：路由到底谁管的、providers 和 exports 差在哪、imports 能不能穿透、@Global() 为什么是例外。这篇把 NestJS 模块系统的两条边界——组织代码与管理依赖可见性——拆开讲。'
pubDate: 'Oct 19 2026'
tags: [NestJS, 依赖注入, 后端]
---

NestJS 里最容易被误解的概念之一，就是 `@Module()`。它有四个参数：`controllers`、`providers`、`imports`、`exports`，但真正让人迷糊的通常不是「它们叫什么」，而是：

- 路由到底是谁管的？
- `providers` 和 `exports` 有什么区别？
- `imports` 到底导入的是什么？
- 为什么路由能不能访问，和 `imports` 关系不大？

这篇文章就围绕这几个问题，把 NestJS 模块系统拆清楚。

## 先记住一句话

**`@Module()` 不是「定义业务逻辑」的地方，而是「给 NestJS 容器一张组织结构图」。**

它告诉 NestJS：

- 哪些 Controller 要生效；
- 哪些 Service 由容器创建；
- 当前模块依赖哪些其他模块；
- 哪些能力可以共享给其他模块。

## 四个参数分别干什么

| 参数 | 作用 | 一句话理解 |
|---|---|---|
| `controllers` | 注册当前模块的控制器 | 决定哪些 Controller 会参与路由注册 |
| `providers` | 注册当前模块的提供者 | 告诉容器「这些类由我来创建和管理」 |
| `imports` | 导入其他模块 | 拿到别的模块 `exports` 出来的能力 |
| `exports` | 导出当前模块的部分提供者 | 决定哪些能力可以被其他模块使用 |

## 用一家公司来类比

把每个 Module 想象成一家公司，会更容易理解。

**`controllers` 是前台窗口。** 它负责接待外部请求。只要这个前台被注册进公司体系，客户就能找到入口。

**`providers` 是内部员工。** 写进 `providers` 的类，由 NestJS 容器负责创建。默认情况下，它们是单例的，也就是整个应用里通常只有一个实例。

**`exports` 是对外合作白名单。** 员工再多，如果没写进 `exports`，别的公司就不能直接调用它。

**`imports` 是采购外部服务。** 你导入一个模块，只能拿到它 `exports` 出来的东西，不能直接访问它的内部员工。

## controllers：管的是「路由生效」，不是「路由字符串」

很多人会在这里卡住：路由到底是什么？

路由本质上就是一个地址，比如：

```text
GET /documents
POST /documents
GET /documents/1
DELETE /documents/1
```

在 NestJS 里，这些地址不是写在路由表里的，而是通过装饰器拼出来的：

```ts
@Controller('documents')
export class DocumentsController {
  @Get()
  findAll() {
    return '获取所有文档';
  }

  @Get(':id')
  findOne() {
    return '获取单个文档';
  }

  @Post()
  create() {
    return '创建文档';
  }
}
```

最终路由由两部分拼接：`@Controller()` 的路径 + `@Get()` / `@Post()` 等方法装饰器的路径。

但这里有个关键点：

> **装饰器决定「路由地址是什么」，`controllers` 决定「这个路由要不要生效」。**

如果你只写了 `DocumentsController`，却没有在任何模块里注册它：

```ts
@Module({
  controllers: [DocumentsController],
})
export class DocumentsModule {}
```

那 NestJS 启动时就不会扫描这个 Controller，它里面的 `@Get()`、`@Post()` 也不会变成真实路由。

所以**路由能不能访问，和 `imports` 无关**。只要一个 Controller 被某个模块的 `controllers` 注册，而这个模块又在从 `AppModule` 出发的模块图里，它的路由就会生效。`imports` 管的是依赖注入，不是路由可见性。

## providers：容器的构造清单

`providers` 里的类，由 NestJS 容器负责实例化。你不需要手动 `new`，只需要在构造函数里声明依赖。

```ts
@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}
}
```

只要 `DocumentsService` 和 `PrismaService` 都被正确注册到容器里，NestJS 就会自动创建实例并注入。

这里有一个很重要的默认行为：**Provider 默认是单例。**

也就是说，整个应用通常只会创建一个 `DocumentsService` 实例，所有请求共享它。所以不要把「每个请求独有」的数据直接挂在 Service 的字段上，否则不同请求之间可能会互相污染。

### `@Injectable()` 和 `providers` 是什么关系

很多人会把这两个东西混在一起，其实它们的职责不同。

- **`@Injectable()` 是「资格认证」。** 它把一个类标记为「可被注入」，并让这个类的构造函数参数也能参与依赖注入。
- **`providers` 是「入职登记」。** 只有写进某个模块的 `providers` 数组，NestJS 才会真正为这个类创建实例，并把它放进容器里。

所以：

> **带 `@Injectable()` 的类不一定都要写进 `providers`；但写进 `providers` 的类，通常都应该带 `@Injectable()`。**

比如你写了 `@Injectable() class DocumentsService {}`，但如果没有在任何模块里把它登记进 `providers`，那 NestJS 就不会管理它，其他类也无法注入它。

反过来，如果你只是把某个类写进了 `providers`，但它内部还要注入别的依赖，那这个类最好加上 `@Injectable()`，否则 NestJS 可能无法正确解析它的构造函数参数。

### 判断要不要写进 providers 的简单规则

| 情况 | 是否要写进 `providers` |
|---|---|
| 这个类要被 NestJS 容器创建 | 要 |
| 这个类要被 Controller 或其他 Service 注入 | 要 |
| 这个类要被别的模块使用 | 要在当前模块 `providers` 里注册，并且还要 `exports` |
| 这个类只是普通工具类，自己 `new` 使用 | 不需要 |
| 这个类带 `@Injectable()` 但没人注入它 | 暂时不需要 |

### 一个容易踩的坑

如果你写了：

```ts
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}
}
```

但 `DocumentsService` 没有在任何模块的 `providers` 里注册，启动时通常会报类似：

```text
Nest can't resolve dependencies of the DocumentsController (?).
```

这往往说明：

- 要么 `DocumentsService` 没加 `@Injectable()`；
- 要么它没有被写进当前模块的 `providers`；
- 要么它来自别的模块，但那个模块没有 `exports`，当前模块也没有 `imports`。

一句话总结：**`@Injectable()` 说明这个类可以被注入，`providers` 说明这个类正式交给 NestJS 容器管理。只有两者都满足，依赖注入才会正常工作。**

## exports：依赖注入的可见性白名单

这是最容易混淆的地方。

很多人会以为：只要写进 `providers`，别的模块就能注入。其实不是。

- **`providers` 表示「我有这个能力」。**
- **`exports` 表示「我允许别人使用这个能力」。**

例如：

```ts
@Module({
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

只有写了 `exports: [DocumentsService]`，其他模块导入 `DocumentsModule` 后，才能注入 `DocumentsService`。如果只写 `providers`、不写 `exports`，那 `DocumentsService` 只能在 `DocumentsModule` 内部使用。

还要注意两点：

1. `exports` 只能导出当前模块已有的提供者，不能导出凭空不存在的类。
2. `exports` 不会重新创建实例，它只是开放访问权限。被导出的提供者通常仍然是同一个单例实例。

## imports：只能拿到对方的 exports，但 @Global() 是例外

`imports` 的作用不是「把整个模块搬进来」，而是：**拿到对方模块 `exports` 出来的提供者。**

比如：

```ts
@Module({
  imports: [PrismaModule],
  providers: [DocumentsService],
})
export class DocumentsModule {}
```

这里 `DocumentsModule` 只能使用 `PrismaModule` 导出的内容。如果 `PrismaModule` 没有把 `PrismaService` 写入 `exports`，那 `DocumentsModule` 就无法注入它。

另外，`imports` 通常不会穿透传递。假设 A 模块导入 B 模块、B 模块导入 C 模块，A 默认拿不到 C 模块导出的东西——除非 B 模块把 C 模块再次导出，A 才能间接使用。

这其实和 ES Module 的导入规则很像：你不能因为 B 引用了 C，就自动在 A 里使用 C。

### 那 @Global() 是什么

`@Global()` 是一个特殊装饰器，它会让某个模块变成**全局模块**：

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

一旦模块被标记为 `@Global()`，它导出的提供者就不需要再被逐个 `imports` 了——整个应用里的任何模块都可以直接注入使用。所以上面的例子中，如果 `PrismaModule` 加了 `@Global()`，那 `DocumentsModule` 就不需要再写 `imports: [PrismaModule]`，直接注入 `PrismaService` 即可。

### 使用 @Global() 的注意事项

1. **全局模块只需要注册一次。** 通常在根模块（`AppModule`）的 `imports` 里导入一次就够了，之后所有模块都能用。
2. **全局模块仍然需要 `exports`。** `@Global()` 只是让 exports 的内容对全应用可见，不会自动导出所有 providers。
3. **谨慎使用。** 全局模块虽然方便，但会让依赖关系变得隐式，不利于模块边界清晰。通常只建议把真正「全应用共享」的基础设施（如数据库连接、配置服务）设为全局。

一句话总结：**普通模块需要显式 `imports` 才能使用对方的 exports；全局模块的 exports 对全应用可见，无需逐个导入。**

## 一个完整例子

```ts
// prisma.module.ts
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

// documents.module.ts
@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

// app.module.ts
@Module({
  imports: [DocumentsModule],
})
export class AppModule {}
```

这里发生的事情是：

1. `PrismaModule` 创建并导出 `PrismaService`。
2. `DocumentsModule` 导入 `PrismaModule`，所以可以注入 `PrismaService`。
3. `DocumentsModule` 注册了 `DocumentsController`，所以它的路由会生效。
4. `DocumentsModule` 导出 `DocumentsService`，所以其他模块导入它后也能使用。
5. `AppModule` 导入 `DocumentsModule`，整个模块被纳入应用。

## 常见误区

1. **只写 `providers`，不写 `exports`**：别的模块注入时会报错，因为它拿不到这个提供者。
2. **以为 `imports` 会穿透**：A → B → C，A 拿不到 C 的 exports，除非 B 再导出一次。
3. **把 Controller 写进 `exports`**：没有意义。Controller 负责接收请求，不会被其他模块注入。
4. **以为路由地址由 `imports` 决定**：不是。路由地址由 `@Controller()` 和方法装饰器决定；`controllers` 只是让路由生效；`imports` 管的是依赖注入。

## 最后总结

可以这样记：

- **`controllers`：决定谁能访问我。**
- **`providers`：决定我有哪些能力。**
- **`exports`：决定哪些能力可以给别人用。**
- **`imports`：决定我能用别人的哪些能力。**

NestJS 的模块系统本质上是在做两件事：**组织代码**和**管理依赖可见性**。把这两个边界想清楚，`@Module()` 的四个参数就不会再互相打架了。
