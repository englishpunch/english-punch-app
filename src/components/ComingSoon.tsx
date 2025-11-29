export default function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 text-center space-y-3">
      <p className="text-lg font-semibold text-gray-900">{label} 페이지 준비중</p>
      <p className="text-sm text-gray-600">조금만 기다려주세요.</p>
    </div>
  );
}
