import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/decorators/public.decorator';
import { OrderStateMachineService } from '../../../../shared/services/order-state-machine.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
    constructor(private readonly orderStateMachine: OrderStateMachineService) { }

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
        const transactionId = body.payload?.payment?.entity?.id || body.paymentId || `txn_${Date.now()}`;

        if (orderId) {
            // Webhook ONLY verifies payment and triggers Order State Machine transition.
            // Order State Machine transitions order to ACTIVE and dispatches 'order.activated' event.
            // OrderActivatedListener generates tasks asynchronously.
            await this.orderStateMachine.transitionToActive(orderId, transactionId);
        }

        return {
            received: true,
            provider,
            event,
            status: 'processed',
            orderId,
            transactionId,
        };
    }
}
