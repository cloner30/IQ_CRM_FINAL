import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { VisaDetailsStatementTable } from './VisaDetailsStatementTable';
import api from '../../utils/api';
import { toast } from 'sonner';

const defaultFromDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const defaultToDate = () => new Date().toISOString().slice(0, 10);

export const VisaStatementPanel = ({ partyType, partyId }) => {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const basePath =
    partyType === 'client'
      ? '/accounting/client-visa-statement'
      : '/accounting/vendor-visa-statement';

  const idParam = partyType === 'client' ? 'client_id' : 'vendor_id';
  const queryBase = partyId ? `&${idParam}=${partyId}` : '';

  const fetchStatement = async () => {
    if (!from || !to) {
      toast.error('Please select both from and to dates');
      return;
    }
    if (from > to) {
      toast.error('From date must be before to date');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`${basePath}?from_date=${from}&to_date=${to}${queryBase}`);
      setData(res.data);
    } catch {
      toast.error('Failed to generate visa statement');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!from || !to) {
      toast.error('Please select both from and to dates');
      return;
    }
    setExporting(true);
    try {
      const response = await api.get(
        `${basePath}/export?from_date=${from}&to_date=${to}&format=${format}${queryBase}`,
        { responseType: 'blob' },
      );
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `visa_statement_${from}_${to}.${ext}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="visa-from">From</Label>
          <Input
            id="visa-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="visa-to">To</Label>
          <Input
            id="visa-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={fetchStatement} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Statement'}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleExport('csv')}
          disabled={exporting}
        >
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => handleExport('pdf')}
          disabled={exporting}
        >
          Export PDF
        </Button>
      </div>

      <VisaDetailsStatementTable data={data} />
    </div>
  );
};
