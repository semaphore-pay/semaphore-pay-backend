declare module '@semaphore-pay/server' {
  export class SemaphorePayEngine<T extends 'pg' | 'sqlite'> {
    dialect: T;
    db: any;
    schema: any;
    supportsTransactions: boolean;
    getCustomerByUserId(input: { userId: string; collectionId: string }): Promise<any>;
    createCustomer(data: { userId: string; email: string | null; name: string | null; collectionId: string }): Promise<string>;
    transaction<T>(handler: (tx: any) => Promise<T>): Promise<T>;
  }

  export interface SemaphorePayConfig<T extends 'pg' | 'sqlite'> {
    dialect: T;
    db: any;
    supportsTransactions?: boolean;
  }

  export function initSemaphorePay<T extends 'pg' | 'sqlite'>(config: SemaphorePayConfig<T>): SemaphorePayEngine<T>;
  export function createSemaphorePayRouter(engine: SemaphorePayEngine<any>, options?: any): any;
  export function createCollection(engine: SemaphorePayEngine<any>, name: string): Promise<any>;
  export function createApiKey(engine: SemaphorePayEngine<any>, input: any): Promise<any>;
  export function createProduct(engine: SemaphorePayEngine<any>, input: any): Promise<any>;
  export function listProducts(engine: SemaphorePayEngine<any>, input: any): Promise<any>;
  export function createPlan(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function listPlans(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function getPlan(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function subscribe(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function cancel(engine: SemaphorePayEngine<any>, subscriptionId: string, context?: any): Promise<any>;
  export function check(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function report(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function upsertCustomer(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function getCustomer(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function handleWebhook(engine: SemaphorePayEngine<any>, input: any): Promise<any>;
  export function runSemaphorePayCron(engine: SemaphorePayEngine<any>, chargeFn?: any): Promise<any>;
  export function getSemaphorePayHooks(engine: SemaphorePayEngine<any>, options?: any): any;

  // Plan API (re-exported from plan.api)
  export function create(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function list(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
  export function get(engine: SemaphorePayEngine<any>, input: any, context: any): Promise<any>;
}

declare module '@semaphore-pay/server/schema/sqlite' {
  export const collection: any;
  export const apiKey: any;
  export const customer: any;
  export const plan: any;
  export const product: any;
  export const subscription: any;
  export const entitlement: any;
  export const feature: any;
  export const paymentMethod: any;
  export const invoice: any;
  export const webhookEvent: any;
  export const productFeature: any;
  export const planFeature: any;
  export const productPurchase: any;
}
