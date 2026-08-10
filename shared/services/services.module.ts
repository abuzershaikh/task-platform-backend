import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { FileStorageService } from './file-storage.service';

@Global()
@Module({
    imports: [DatabaseModule],
    providers: [
        AuditLogService,
        NotificationService,
        FileStorageService,
    ],
    exports: [
        AuditLogService,
        NotificationService,
        FileStorageService,
    ],
})
export class ServicesModule { }
