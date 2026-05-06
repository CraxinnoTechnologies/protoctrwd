import { OrdersView } from "@/app/_components/orders/OrdersView";

export default function Page() {
  return (
    <OrdersView
      channel="request"
      channelLabel="Order Request"
      title="Order Requests"
      subtitle="Quote and custom order requests awaiting review."
    />
  );
}
