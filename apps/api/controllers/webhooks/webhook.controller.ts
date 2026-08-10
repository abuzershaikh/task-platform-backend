import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/decorators/public.decorator';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';
import { TaskEngineService } from '../../../../task-engine/task-engine.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly taskEngine: TaskEngineService,
    ) { }

    @Public()
    @Post('payment/:provider')
    @ApiOperation({ summary: 'Receive payment gateway webhooks (Razorpay / Stripe / Cashfree)' })
    async handlePaymentWebhook(
        @Param('provider') provider: string,
        @Body() body: any,
        @Headers('x-razorpay-signature') razorpaySignature?: string,
        @Headers('stripe-signature') stripeSignature?: string,
    ) {
        const event = body.event || body.type || 'payment.captured';
        const orderId = body.payload?.payment?.entity?.notes?.orderId || body.orderId;

        if (orderId) {
            const order = await this.orderRepo.findById(orderId);
            if (order && (order.status === 'PAYMENT_PENDING' || order.status === 'draft')) {
                // Transition order to ACTIVE
                await this.orderRepo.update(orderId, { status: 'ACTIVE' });

                // Generate individual tasks using the order's immutable workerRewardSnapshot
                const rewardAmount = Number(order.workerRewardSnapshot || order.rewardPerTask || 5);
                for (let i = 0; i < order.totalTasksRequired; i++) {
                    await this.taskEngine.createTask({
                        orderId: order.id,
                        campaignId: order.id,
                        taskType: order.taskType,
                        requirements: order.requirements,
                        rewardAmount,
                    });
                }
            }
        }

        return {
            received: true,
            provider,
            event,
            status: 'processed',
        };
    }
}
