import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import api from '../../utils/api';
import { useGroupStatus } from '../../contexts/GroupStatusContext';

export const GroupHistoryTab = ({ groupId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getLabel } = useGroupStatus();

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
    fetchHistory();
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
              <div key={entry.id} className="border-l-2 border-primary pl-4 py-1">
                <p className="font-medium">
                  {getLabel(entry.old_status)} → {getLabel(entry.new_status)}
                  {entry.action === 'split' && ' (split)'}
                  {entry.action === 'unassign_vendor' && ' (vendor unassigned)'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.changed_by_name} · {new Date(entry.timestamp).toLocaleString()}
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

export default GroupHistoryTab;
