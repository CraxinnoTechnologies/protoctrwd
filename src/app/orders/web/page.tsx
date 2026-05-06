import { OrdersView } from "@/app/_components/orders/OrdersView";

export default function Page() {
  return (
    <OrdersView
      channel="web"
      channelLabel="Web Order"
      title="Web Orders"
      subtitle="Direct-to-consumer orders received through the website."
    />
  );
}
