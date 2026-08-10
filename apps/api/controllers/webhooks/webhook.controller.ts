import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/decorators/public.decorator';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
    constructor(private readonly orderRepo: OrderRepository) { }

    @Public()
    @Post('payment/:provider')
    @ApiOperation({ summary: 'Receive payment gateway webhooks (Razorpay / Stripe / Cashfree)' })
    async handlePaymentWebhook(
        @Param('provider') provider: string,
        @Body() body: any,
        @Headers('x-razorpay-signature') razorpaySignature?: string,
        @Headers('stripe-signature') stripeSignature?: string,
    ) {
        // Log webhook payload
        const event = body.event || body.type || 'payment.captured';
        const orderId = body.payload?.payment?.entity?.notes?.orderId || body.orderId;

        if (orderId) {
            const order = await this.orderRepo.findById(orderId);
            if (order && order.status === 'PAYMENT_PENDING') {
                await this.orderRepo.update(orderId, { status: 'ACTIVE' });
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
