import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import api from '../../utils/api';

const STATUS_LABELS = {
  DATA_ENTRY: 'Data Entry',
  SUBMITTED: 'Submitted',
  PENDING_PROCESS: 'Pending Process',
  VISA_SUBMITTED: 'Visa Submitted',
  VISA_ISSUED: 'Visa Issued',
  VISA_REJECTED: 'Visa Rejected',
  COMPLETED: 'Completed',
};

export const GroupHistoryTab = ({ groupId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get(`/groups/${groupId}/status-history`);
        setHistory(response.data);
      } catch (error) {
        console.error('Failed to fetch status history:', error);
      } finally {
        setLoading(false);
      }
    };
    if (groupId) fetchHistory();
  }, [groupId]);

  if (loading) return <p className="text-muted-foreground">Loading history...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status History</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-muted-foreground">No status changes yet.</p>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="border-l-2 border-primary pl-4 py-2">
                <p className="font-medium">
                  {STATUS_LABELS[entry.old_status] || entry.old_status} → {STATUS_LABELS[entry.new_status] || entry.new_status}
                </p>
                <p className="text-sm text-muted-foreground">
                  by {entry.changed_by_name} · {new Date(entry.timestamp).toLocaleString()}
                </p>
                {entry.reason && <p className="text-sm mt-1">{entry.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
