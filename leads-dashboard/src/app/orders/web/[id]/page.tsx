import { OrderDetailView } from "@/app/_components/orders/OrderDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView channel="web" orderId={id} />;
}
