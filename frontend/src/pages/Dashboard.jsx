import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, FileText, Plus, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPassports = groups.reduce((sum, g) => sum + (g.passport_count || 0), 0);

  return (
    <div data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-manrope font-bold text-slate-900 tracking-tight" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="text-slate-600 mt-1">Manage your passport groups and records</p>
        </div>
        <Link to="/groups/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="create-group-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="card-hover" data-testid="stat-groups">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Groups</p>
                <p className="text-2xl font-manrope font-bold text-slate-900">{groups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="stat-passports">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Passports</p>
                <p className="text-2xl font-manrope font-bold text-slate-900">{totalPassports}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <Card data-testid="groups-list-card">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="font-manrope">Recent Groups</CardTitle>
            <Link to="/groups" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-state">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No groups yet. Create your first group to get started.</p>
              <Link to="/groups/new">
                <Button variant="outline" data-testid="empty-create-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Group
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100" data-testid="groups-table">
              {groups.slice(0, 5).map((group) => (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                  data-testid={`group-row-${group.id}`}
                >
                  <div>
                    <h3 className="font-medium text-slate-900">{group.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{group.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="status-badge neutral">
                      {group.passport_count || 0} passports
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
