import { connect, type NatsConnection, StringCodec } from 'nats';

export type DomainEvent<T = Record<string, unknown>> = {
  id: string;
  type: string;
  tenantId: string;
  timestamp: string;
  payload: T;
  correlationId: string;
};

const codec = StringCodec();
let connection: NatsConnection | undefined;

export async function bus(): Promise<NatsConnection> {
  if (!connection) {
    connection = await connect({ servers: process.env.NATS_URL ?? 'nats://nats:4222' });
  }
  return connection;
}

export async function publishEvent(event: DomainEvent): Promise<void> {
  const nc = await bus();
  nc.publish(event.type, codec.encode(JSON.stringify(event)));
}

export async function subscribeEvent(
  subject: string,
  handler: (event: DomainEvent) => Promise<void>
): Promise<void> {
  const nc = await bus();
  const sub = nc.subscribe(subject);
  (async () => {
    for await (const msg of sub) {
      const event = JSON.parse(codec.decode(msg.data)) as DomainEvent;
      await handler(event);
    }
  })();
}
