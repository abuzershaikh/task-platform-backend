import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository, AuditLogFilterOptions } from '../database/repositories/audit-log.repository';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface LogAuditParams {
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    previousState?: any;
    newState?: any;
    metadata?: any;
    ip?: string;
    userAgent?: string;
    requestId?: string;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly auditLogRepo: AuditLogRepository) { }

    async log(params: LogAuditParams): Promise<AuditLog> {
        try {
            return await this.auditLogRepo.create({
                actorId: params.actorId,
                actorRole: params.actorRole,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                previousState: params.previousState,
                newState: params.newState,
                metadata: params.metadata,
                ip: params.ip,
                userAgent: params.userAgent,
                requestId: params.requestId,
            });
        } catch (error) {
            this.logger.error(`Failed to record audit log for action ${params.action}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getLogs(options: AuditLogFilterOptions) {
        return this.auditLogRepo.findLogs(options);
    }
}
