interface StatsCardProps {
  title: string;
  value: number;
  unit: string;
  icon: string;
  color: string;
}

export function StatsCard({ title, value, unit, icon, color }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline mt-2">
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            <p className="ml-2 text-sm text-gray-500">{unit}</p>
          </div>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}
