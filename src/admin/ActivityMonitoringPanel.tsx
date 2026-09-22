import React, { useEffect, useState } from "react";
import { Eye, Download, User, Clock, Type, Pulse, Trash as Trash2, MagnifyingGlass } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminFlags } from "../components/Skeleton";

interface ActivityLog {
  id: string;
  business_id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  timestamp: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

interface ActivityStats {
  totalActions: number;
  byActionType: Array<{ action_type: string; count: number }>;
  byEntityType: Array<{ entity_type: string; count: number }>;
}

interface UserSummary {
  userId: string;
  totalActions: number;
  lastActivityAt?: string;
  actionTypeDistribution: Array<{ action_type: string; count: number }>;
}

export function ActivityMonitoringPanel({ businessId }: { businessId?: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: "",
    actionType: "",
    entityType: "",
    startDate: "",
    endDate: "",
  });
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [pagination, setPagination] = useState({ limit: 100, offset: 0 });
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (businessId) {
      loadActivityData();
    }
  }, [businessId, filters, pagination]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        businessId,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.actionType && { actionType: filters.actionType }),
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      });

      const [logsResponse, statsResponse] = await Promise.all([
        api.get(`/api/admin/activity-logs?${params}`),
        api.get(`/api/admin/activity-logs/stats?businessId=${businessId}`),
      ]);

      setLogs(logsResponse.data.logs || []);
      setTotalCount(logsResponse.data.total || 0);
      setStats(statsResponse.data);
    } catch (err) {
      console.error("Failed to load activity data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ limit: 100, offset: 0 });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        businessId,
        format: "csv",
      });
      window.open(`/api/admin/activity-logs/export?${params}`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleViewUserSummary = async (userId: string) => {
    try {
      const response = await api.get(`/api/admin/activity-logs/user-summary/${userId}`, {
        params: { businessId },
      });
      setSelectedUser(response.data);
    } catch (err) {
      console.error("Failed to load user summary:", err);
    }
  };

  if (!businessId) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Pulse className="w-8 h-8 mx-auto mb-3 text-slate-400" />
        <p className="text-sm">Activity monitoring requires a business context. Please select a business or refresh the page.</p>
      </div>
    );
  }

  if (loading && logs.length === 0) {
    return <SkeletonAdminFlags />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-3xl font-bold text-emerald-600">{stats.totalActions.toLocaleString()}</div>
            <div className="text-sm text-slate-600">Total Actions (Last 30 Days)</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-3xl font-bold text-blue-600">{stats.byActionType.length}</div>
            <div className="text-sm text-slate-600">Action Types</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-3xl font-bold text-amber-600">{stats.byEntityType.length}</div>
            <div className="text-sm text-slate-600">Entity Types</div>
          </div>
        </div>
      )}

      {/* Action Type Distribution */}
      {stats && stats.byActionType.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Actions by Type
          </h3>
          <div className="space-y-2">
            {stats.byActionType.map((item) => (
              <div key={item.action_type} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 capitalize">{item.action_type}</span>
                <div className="flex items-center gap-2">
                  <div className="bg-slate-200 rounded-full h-2 w-32 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{
                        width: `${(item.count / (stats.totalActions || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-slate-500 w-12 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <MagnifyingGlass className="w-4 h-4" /> Filters
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="email"
            placeholder="Filter by user email"
            value={filters.userId}
            onChange={(e) => handleFilterChange("userId", e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
          <select
            value={filters.actionType}
            onChange={(e) => handleFilterChange("actionType", e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          >
            <option value="">All Action Types</option>
            <option value="create">Create</option>
            <option value="read">Read</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="upload">Upload</option>
            <option value="download">Download</option>
            <option value="export">Export</option>
            <option value="payment">Payment</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
          <input
            type="text"
            placeholder="Filter by entity type"
            value={filters.entityType}
            onChange={(e) => handleFilterChange("entityType", e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
          />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
            placeholder="Start date"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setFilters({ userId: "", actionType: "", entityType: "", startDate: "", endDate: "" })}
            className="text-sm text-slate-600 hover:text-slate-900 font-semibold"
          >
            Clear Filters
          </button>
          <button
            onClick={handleExport}
            className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Entity Type</th>
                <th className="px-4 py-3 text-left font-semibold">IP Address</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewUserSummary(log.user_id)}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      <User className="w-3 h-3" /> {log.user_id.slice(0, 8)}...
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.action_type === "create"
                          ? "bg-green-100 text-green-700"
                          : log.action_type === "delete"
                            ? "bg-red-100 text-red-700"
                            : log.action_type === "update"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {log.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.entity_type}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{log.ip_address || "unknown"}</td>
                  <td className="px-4 py-3">
                    {log.changes && (
                      <button
                        onClick={() => console.log(log.changes)}
                        className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activity logs found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <span className="text-sm text-slate-600">
            Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
              disabled={pagination.offset === 0}
              className="px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
              disabled={pagination.offset + pagination.limit >= totalCount}
              className="px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* User Summary Modal-style Info */}
      {selectedUser && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-blue-900">User Activity Summary</h4>
              <p className="text-xs text-blue-700 mt-1">User: {selectedUser.userId}</p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-blue-600 hover:text-blue-800 font-semibold text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-2xl font-bold text-blue-700">{selectedUser.totalActions}</div>
              <div className="text-xs text-blue-600">Total Actions</div>
            </div>
            <div>
              <div className="text-sm text-blue-700">{selectedUser.lastActivityAt ? new Date(selectedUser.lastActivityAt).toLocaleString() : "Never"}</div>
              <div className="text-xs text-blue-600">Last Activity</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityMonitoringPanel;
