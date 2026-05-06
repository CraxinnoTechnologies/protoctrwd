import { OrdersView } from "@/app/_components/orders/OrdersView";

export default function Page() {
  return (
    <OrdersView
      channel="stock"
      channelLabel="Stock Order"
      title="Stock Orders"
      subtitle="Internal warehouse replenishment orders."
    />
  );
}
