import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { VisaStatementPanel } from '../../components/accounting/VisaStatementPanel';
import api from '../../utils/api';
import { toast } from 'sonner';

export const VisaStatement = () => {
  const [partyType, setPartyType] = useState('client');
  const [partyId, setPartyId] = useState('');
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/accounting/client-ledgers').catch(() => ({ data: [] })),
      api.get('/accounting/vendor-ledgers').catch(() => ({ data: [] })),
    ]).then(([clientsRes, vendorsRes]) => {
      const clientRows = clientsRes.data || [];
      const vendorRows = vendorsRes.data || [];
      setClients(clientRows);
      setVendors(vendorRows);
      if (clientRows.length > 0) {
        setPartyId(clientRows[0].client_id);
      }
    }).catch(() => toast.error('Failed to load parties'));
  }, []);

  useEffect(() => {
    const rows = partyType === 'client' ? clients : vendors;
    if (rows.length > 0) {
      const id = partyType === 'client' ? rows[0].client_id : rows[0].vendor_id;
      setPartyId(id);
    } else {
      setPartyId('');
    }
  }, [partyType, clients, vendors]);

  const parties = partyType === 'client' ? clients : vendors;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/accounting" className="text-sm text-muted-foreground hover:underline">
          ← Accounting
        </Link>
        <h1 className="text-3xl font-bold mt-1">Visa Details Statement</h1>
        <p className="text-muted-foreground mt-1">
          Passenger-level statement with opening balance, running balance, and period payments
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4">
          <div>
            <Label>Party Type</Label>
            <Select value={partyType} onValueChange={setPartyType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{partyType === 'client' ? 'Client' : 'Vendor'}</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={`Select ${partyType}`} />
              </SelectTrigger>
              <SelectContent>
                {parties.map((p) => {
                  const id = partyType === 'client' ? p.client_id : p.vendor_id;
                  const name = partyType === 'client' ? p.client_name : p.vendor_name;
                  return (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {partyId ? (
        <VisaStatementPanel partyType={partyType} partyId={partyId} />
      ) : (
        <p className="text-muted-foreground">No {partyType}s available.</p>
      )}
    </div>
  );
};
