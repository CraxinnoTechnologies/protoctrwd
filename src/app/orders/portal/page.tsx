import { OrdersView } from "@/app/_components/orders/OrdersView";

export default function Page() {
  return (
    <OrdersView
      channel="portal"
      channelLabel="Portal Order"
      title="Portal Orders"
      subtitle="All orders submitted through the customer portal."
    />
  );
}
