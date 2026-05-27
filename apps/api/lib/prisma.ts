import { PrismaClient, type Record } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export function serializeRecordData(data: any): string {
  return JSON.stringify(data)
}

export function serializeArray(arr: any[]): string {
  return JSON.stringify(arr)
}

export function deserializeRecordData(str: string): any {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

export function deserializeArray(str: string): any[] {
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}

export function deserializeRecord(record: Record) {
  return {
    ...record,
    data: deserializeRecordData(record.data),
    tags: deserializeArray(record.tags),
    attachments: deserializeArray(record.attachments)
  }
}

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
