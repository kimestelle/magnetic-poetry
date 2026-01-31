import PoemBoard from '../components/PoemBoard';

export default async function Page({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  return <PoemBoard isShared={true} boardId={boardId} />;
}
