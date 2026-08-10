import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { FileStorageService } from './file-storage.service';
import { PricingEngineService } from './pricing-engine.service';
import { RatingEngineService } from './rating-engine.service';

@Global()
@Module({
    imports: [DatabaseModule],
    providers: [
        AuditLogService,
        NotificationService,
        FileStorageService,
        PricingEngineService,
        RatingEngineService,
    ],
    exports: [
        AuditLogService,
        NotificationService,
        FileStorageService,
        PricingEngineService,
        RatingEngineService,
    ],
})
export class ServicesModule { }
