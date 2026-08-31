import { createClient } from '@/lib/supabase/server';
import ItemGrid from '@/components/items/ItemGrid';

export default async function ItemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">物品</h1>
        <button className="btn-primary">+ 添加物品</button>
      </div>
      <ItemGrid items={items ?? []} />
    </div>
  );
}
