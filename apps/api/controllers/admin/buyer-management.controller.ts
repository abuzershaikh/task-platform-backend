import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRepository } from '../../../../shared/database/repositories/user.repository';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole, UserStatus } from '../../../../shared/database/entities/user.entity';

@ApiTags('Admin - Buyer Management')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
@Controller('admin/buyers')
export class AdminBuyerManagementController {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly orderRepo: OrderRepository,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List all buyers' })
    async listBuyers() {
        const buyers = await this.userRepo.findByRole(UserRole.BUYER);
        return {
            success: true,
            buyers,
            total: buyers.length,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get buyer details and order history' })
    async getBuyerDetail(@Param('id') buyerId: string) {
        const buyer = await this.userRepo.findById(buyerId);
        if (!buyer || buyer.role !== UserRole.BUYER) {
            throw new NotFoundException('Buyer not found');
        }

        const orders = await this.orderRepo.findByBuyer(buyerId);
        return {
            success: true,
            buyer,
            orders,
        };
    }

    @Post(':id/status')
    @ApiOperation({ summary: 'Update buyer status (ACTIVE, SUSPENDED, BANNED)' })
    async updateStatus(
        @Param('id') buyerId: string,
        @Body() body: { status: UserStatus },
    ) {
        const buyer = await this.userRepo.findById(buyerId);
        if (!buyer || buyer.role !== UserRole.BUYER) {
            throw new NotFoundException('Buyer not found');
        }

        await this.userRepo.updateStatus(buyerId, body.status);
        return {
            success: true,
            message: `Buyer status updated to ${body.status}`,
        };
    }
}
