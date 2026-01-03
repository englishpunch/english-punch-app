export default function ComingSoon({ label }: { label: string }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-lg font-semibold text-gray-900">
        {label} 페이지 준비중
      </p>
      <p className="text-sm text-gray-600">조금만 기다려주세요.</p>
    </div>
  );
}
