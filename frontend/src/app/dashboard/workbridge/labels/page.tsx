'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Tag, Plus, Edit2, Trash2, Palette, Search, Circle, Heart, Star, Shield, Layers } from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';

const DiamondIcon = ({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5L21.5 12L12 21.5L2.5 12L12 2.5Z" />
  </svg>
);

const CATEGORIES = [
  { id: 'ALL', name: 'All', icon: Layers },
  { id: 'GENERAL', name: 'General', icon: Circle, shape: 'circle' },
  { id: 'PEOPLE', name: 'Employees', icon: Heart, shape: 'heart' },
  { id: 'PRIORITY', name: 'Priority', icon: Star, shape: 'star' },
  { id: 'PROJECT', name: 'Planning', icon: DiamondIcon, shape: 'diamond' },
  { id: 'SECURITY', name: 'Security', icon: Shield, shape: 'shield' },
];

export default function WorkBridgeLabelsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('task_labels_create') || hasPermission('labels_create');
  const canEdit = isSuperAdmin || hasPermission('task_labels_edit') || hasPermission('labels_edit');
  const canDelete = isSuperAdmin || hasPermission('task_labels_delete') || hasPermission('labels_delete');

  const activeCompanyId = globalCompanyId;

  const [labels, setLabels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    color_code: '#2563eb',
    description: 'General Work / Task',
  });

  const presetColors = [
    '#2563eb', // Blue
    '#16a34a', // Green
    '#eab308', // Yellow
    '#f97316', // Orange
    '#dc2626', // Red
    '#9333ea', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#18181b', // Black
    '#64748b', // Slate
  ];

  useEffect(() => {
    fetchLabels();
  }, [activeCompanyId]);

  const fetchLabels = async () => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/workbridge/labels?company_id=${cid}` : `${API_BASE}/api/v1/workbridge/labels`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels || []);
      }
    } catch (e) {
      showToast('Error loading labels', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getLabelCategoryKey = (label: any) => {
    const cat = (label.description || '').toLowerCase();
    const name = (label.name || label.label_name || '').toLowerCase();

    if (cat.includes('people') || name.includes('employee') || name.includes('customer') || name.includes('client')) return 'PEOPLE';
    if (cat.includes('priority') || name.includes('priority') || name.includes('important') || name.includes('featured')) return 'PRIORITY';
    if (cat.includes('project') || cat.includes('planning') || name.includes('project') || name.includes('milestone') || name.includes('planning') || name.includes('deliverable') || name.includes('requirement') || name.includes('dependency')) return 'PROJECT';
    if (cat.includes('security') || cat.includes('control') || cat.includes('compliance') || name.includes('security') || name.includes('access') || name.includes('compliance') || name.includes('policy') || name.includes('confidential') || name.includes('risk')) return 'SECURITY';
    return 'GENERAL';
  };

  const renderShapeIcon = (label: any, className = 'w-4 h-4') => {
    const key = getLabelCategoryKey(label);
    const color = label.color_code || label.label_color || '#2563eb';

    switch (key) {
      case 'PEOPLE':
        return <Heart className={className} style={{ color, fill: `${color}35` }} />;
      case 'PRIORITY':
        return <Star className={className} style={{ color, fill: `${color}35` }} />;
      case 'PROJECT':
        return <DiamondIcon className={className} style={{ color, fill: `${color}35` }} />;
      case 'SECURITY':
        return <Shield className={className} style={{ color, fill: `${color}35` }} />;
      case 'GENERAL':
      default:
        return <Circle className={className} style={{ color, fill: `${color}35` }} />;
    }
  };

  const handleOpenDrawer = (label?: any) => {
    if (label) {
      setEditingLabel(label);
      setForm({
        name: label.name || label.label_name || '',
        color_code: label.color_code || label.label_color || '#2563eb',
        description: label.description || 'General Work / Task',
      });
    } else {
      setEditingLabel(null);
      setForm({
        name: '',
        color_code: '#2563eb',
        description: 'General Work / Task',
      });
    }
    setDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Please specify Label Name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const payload = {
        ...form,
        company_id: cid,
      };

      const url = editingLabel
        ? `${API_BASE}/api/v1/workbridge/labels/${editingLabel.id}`
        : `${API_BASE}/api/v1/workbridge/labels`;
      const method = editingLabel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingLabel ? 'Label updated!' : 'Label created!', 'success');
        setDrawerOpen(false);
        fetchLabels();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save label', 'error');
      }
    } catch (e) {
      showToast('Network error saving label', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this label tag?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/workbridge/labels/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Label deleted', 'success');
        fetchLabels();
      }
    } catch (e) {
      showToast('Error deleting label', 'error');
    }
  };

  const filteredLabels = labels.filter((l) => {
    const matchesSearch = (l.name || l.label_name)?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || getLabelCategoryKey(l) === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fadeIn select-none relative">
      <DashboardPageHeader
        title="Master Labels & Tags"
        subtitle="Categorized shape badges and domain color tags for project tasks"
      />

      {/* Main Listing Panel */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-2xs space-y-6">
        
        {/* Top Header Controls: Search & Category Tabs */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          
          {/* Category Filter Tabs with Updated Short Clean Names */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.id;
              const count = cat.id === 'ALL' 
                ? labels.length 
                : labels.filter(l => getLabelCategoryKey(l) === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="relative w-full sm:w-56">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search label tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {canCreate && (
              <button
                onClick={() => handleOpenDrawer()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs"
              >
                <Plus className="w-4 h-4" /> Add Label
              </button>
            )}
          </div>
        </div>

        {/* Labels Content Grid */}
        {isLoading ? (
          <PageLoader message="Loading Master Labels..." />
        ) : filteredLabels.length === 0 ? (
          <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto my-6">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
              <Tag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Label Tags Found</h3>
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">
              No label tags match your current filter or query.
            </p>
            {canCreate && (
              <button
                onClick={() => handleOpenDrawer()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs text-xs transition-all"
              >
                <Plus className="w-4 h-4" /> Add Label Tag
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredLabels.map((l) => {
              const color = l.color_code || l.label_color || '#2563eb';
              const name = l.name || l.label_name;
              return (
                <div
                  key={l.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-2xs hover:border-blue-500 hover:shadow-xs transition-all group"
                >
                  {/* Left: Distinct Category Shape Icon & Vivid Thick Label Badge */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                      {renderShapeIcon(l, 'w-4 h-4')}
                    </div>
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-extrabold truncate max-w-[150px] border shadow-2xs"
                      style={{
                        backgroundColor: `${color}22`,
                        borderColor: `${color}50`,
                        color: color,
                      }}
                      title={name}
                    >
                      {name}
                    </span>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenDrawer(l)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Tag"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(l.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Delete Tag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Slide Drawer */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingLabel ? 'Edit Label Tag 🏷️' : 'Add New Label Tag 🏷️'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-slate-800 dark:text-white">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Label Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Critical Task, Employee Issue, Risk"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category & Shape Group *</label>
            <select
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="General Work / Task">● CIRCLE — General</option>
              <option value="People / Employee / Customer">♥ HEART — Employees</option>
              <option value="Priority / Important">★ STAR — Priority</option>
              <option value="Project / Planning">◆ DIAMOND — Planning</option>
              <option value="Security / Control / Compliance">🛡 SHIELD — Security</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-blue-600" /> Color Accent
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color_code}
                onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer bg-white"
              />
              <input
                type="text"
                value={form.color_code}
                onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color_code: color })}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color_code.toLowerCase() === color.toLowerCase() ? 'border-slate-800 scale-110 shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingLabel ? 'Update Label' : 'Create Label'}
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
