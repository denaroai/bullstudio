import type { DashboardConfig } from "@bullstudio/embedded-core";
import { bullstudio as expressBullstudio } from "@bullstudio/express";
import { bullstudio as fastifyBullstudio } from "@bullstudio/fastify";
import {
  Module,
  type DynamicModule,
  type InjectionToken,
  type ModuleMetadata,
  type OnModuleInit,
  type Provider,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

const BULLSTUDIO_CONFIG = Symbol("BULLSTUDIO_CONFIG");
const mountedHttpAdapters = new WeakSet<object>();

export interface NestDashboardConfig extends DashboardConfig {
  mountPath: string;
}

export interface BullstudioModuleAsyncOptions<
  TFactoryArgs extends unknown[] = unknown[],
> {
  imports?: ModuleMetadata["imports"];
  inject?: InjectionToken[];
  useFactory: (
    // Nest async factories receive values from the optional inject array.
    ...args: TFactoryArgs
  ) => NestDashboardConfig | Promise<NestDashboardConfig>;
}

class BullstudioMountService implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly config: NestDashboardConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const mountPath = normalizeMountPath(this.config.mountPath);
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const platform = httpAdapter.getType();
    const instance = httpAdapter.getInstance();

    if (mountedHttpAdapters.has(instance)) {
      throw new Error(
        "BullstudioModule can only be mounted once per Nest application.",
      );
    }

    const dashboardConfig = toDashboardConfig(this.config);

    if (platform === "express") {
      mountedHttpAdapters.add(instance);
      instance.use(mountPath, expressBullstudio(dashboardConfig));
      return;
    }

    if (platform === "fastify") {
      mountedHttpAdapters.add(instance);
      await instance.register(fastifyBullstudio(dashboardConfig), {
        prefix: mountPath,
      });
      return;
    }

    throw new Error(
      `BullstudioModule only supports Nest Express and Fastify platforms. Received "${platform}".`,
    );
  }
}

@Module({})
export class BullstudioModule {
  static forRoot(config: NestDashboardConfig): DynamicModule {
    return {
      module: BullstudioModule,
      providers: [
        {
          provide: BULLSTUDIO_CONFIG,
          useValue: config,
        },
        createMountServiceProvider(),
      ],
    };
  }

  static forRootAsync<TFactoryArgs extends unknown[]>(
    options: BullstudioModuleAsyncOptions<TFactoryArgs>,
  ): DynamicModule {
    return {
      module: BullstudioModule,
      imports: options.imports,
      providers: [
        createAsyncConfigProvider(options),
        createMountServiceProvider(),
      ],
    };
  }
}

function createMountServiceProvider(): Provider<BullstudioMountService> {
  return {
    provide: BullstudioMountService,
    inject: [HttpAdapterHost, BULLSTUDIO_CONFIG],
    useFactory: (
      httpAdapterHost: HttpAdapterHost,
      config: NestDashboardConfig,
    ) => new BullstudioMountService(httpAdapterHost, config),
  };
}

function createAsyncConfigProvider<TFactoryArgs extends unknown[]>(
  options: BullstudioModuleAsyncOptions<TFactoryArgs>,
): Provider<NestDashboardConfig> {
  return {
    provide: BULLSTUDIO_CONFIG,
    inject: options.inject ?? [],
    useFactory: options.useFactory,
  };
}

function normalizeMountPath(mountPath: string): string {
  const trimmed = mountPath.trim();

  if (!trimmed) {
    throw new Error("BullstudioModule requires a non-empty mountPath.");
  }

  if (trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function toDashboardConfig(config: NestDashboardConfig): DashboardConfig {
  const { mountPath: _mountPath, ...dashboardConfig } = config;

  return dashboardConfig;
}
