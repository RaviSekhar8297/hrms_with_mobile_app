'use client';

import React, { useEffect, useState } from 'react';
import DashboardPageHeader from '../../components/DashboardPageHeader';
import { getHeaders, API_BASE } from '../../utils/api';
import SlideDrawer from '../../components/SlideDrawer';
import { useDashboard } from '../../components/DashboardContext';
import { usePermissions } from '../../hooks/usePermissions';
import SearchableSelect from '../../components/SearchableSelect';
import { Plus, Edit2, Trash2, ArrowRight, Layers, Palette, Save, CheckCircle2, CircleDashed, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

export default function WorkBridgeWorkflowsPage() {
  const { showToast, companyId: globalCompanyId } = useDashboard();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const canCreate = isSuperAdmin || hasPermission('workflows_create');
  const canEdit = isSuperAdmin || hasPermission('workflows_edit');
  const canDelete = isSuperAdmin || hasPermission('workflows_delete');

  const activeCompanyId = globalCompanyId;

  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [stageForm, setStageForm] = useState({
    name: '',
    color_code: '#2563eb',
    department_id: '', // '' means All / Global
    insert_after_index: -1, // -1 means at the end
    is_initial: false,
    is_final: false,
  });

  useEffect(() => {
    fetchDepartments();
    fetchWorkflow('ALL');
  }, [activeCompanyId]);

  const fetchDepartments = async () => {
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const url = cid && cid !== 'all' ? `${API_BASE}/api/v1/departments?company_id=${cid}` : `${API_BASE}/api/v1/departments`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.departments || []);
        
        // Deduplicate departments by normalized name (case-insensitive)
        const uniqueDepts: any[] = [];
        const seenNames = new Set<string>();

        list.forEach((d: any) => {
          const rawName = (d.name || d.department_name || '').trim();
          const normalizedKey = rawName.toLowerCase();
          if (rawName && !seenNames.has(normalizedKey)) {
            seenNames.add(normalizedKey);
            uniqueDepts.push({
              ...d,
              cleanName: rawName,
            });
          }
        });

        setDepartments(uniqueDepts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWorkflow = async (deptId?: string) => {
    setIsLoading(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');
      const targetDept = deptId !== undefined ? deptId : selectedDepartmentFilter;
      let url = `${API_BASE}/api/v1/workbridge/workflows?company_id=${cid}`;
      if (targetDept && targetDept !== 'ALL') {
        url += `&department_id=${targetDept}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.workflows || [];
        if (list.length > 0) {
          setStages(list.map((w: any) => ({
            id: w.status_key,
            name: w.status_label,
            color_code: w.status_color || '#2563eb',
            department_id: w.department_id || '',
            department_name: w.department_name || '',
            is_initial: !!w.is_initial,
            is_final: !!w.is_final,
          })));
        } else {
          // Default clean initial workflow pipeline
          setStages([
            { id: 'STAGE_BACKLOG', name: 'Backlog', color_code: '#64748b', department_id: '', is_initial: true, is_final: false },
            { id: 'STAGE_IN_PROGRESS', name: 'In Progress', color_code: '#2563eb', department_id: '', is_initial: false, is_final: false },
            { id: 'STAGE_IN_REVIEW', name: 'In Review', color_code: '#d97706', department_id: '', is_initial: false, is_final: false },
            { id: 'STAGE_DONE', name: 'Completed', color_code: '#16a34a', department_id: '', is_initial: false, is_final: true },
          ]);
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading workflow', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenStageDrawer = (index?: number) => {
    if (index !== undefined && index >= 0) {
      setEditingStageIndex(index);
      const st = stages[index];
      setStageForm({
        name: st.name || '',
        color_code: st.color_code || '#2563eb',
        department_id: st.department_id || '',
        insert_after_index: index > 0 ? index - 1 : -2, // -2 means first position
        is_initial: !!st.is_initial,
        is_final: !!st.is_final,
      });
    } else {
      setEditingStageIndex(null);
      setStageForm({
        name: '',
        color_code: '#2563eb',
        department_id: selectedDepartmentFilter !== 'ALL' ? selectedDepartmentFilter : '',
        insert_after_index: stages.length - 1, // default at the end
        is_initial: false,
        is_final: false,
      });
    }
    setDrawerOpen(true);
  };

  const handleSaveStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageForm.name.trim()) {
      showToast('Please enter stage name', 'error');
      return;
    }

    const deptObj = departments.find((d) => d.id === stageForm.department_id);
    const updatedItem = {
      id: editingStageIndex !== null ? stages[editingStageIndex].id : `STAGE_${stageForm.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${Date.now()}`,
      name: stageForm.name.trim(),
      color_code: stageForm.color_code,
      department_id: stageForm.department_id || '',
      department_name: deptObj ? (deptObj.cleanName || deptObj.name || deptObj.department_name) : '',
      is_initial: stageForm.is_initial,
      is_final: stageForm.is_final,
    };

    let newStages = [...stages];

    if (editingStageIndex !== null && editingStageIndex >= 0) {
      // Remove editing item first
      newStages.splice(editingStageIndex, 1);
    }

    // Insert at specified position
    const pos = stageForm.insert_after_index;
    if (pos === -2) {
      // First position
      newStages.unshift(updatedItem);
    } else if (pos >= 0 && pos < newStages.length) {
      newStages.splice(pos + 1, 0, updatedItem);
    } else {
      // End position
      newStages.push(updatedItem);
    }

    setStages(newStages);
    setDrawerOpen(false);
  };

  const handleDeleteStage = (index: number) => {
    if (!canDelete) {
      showToast('Permission denied to delete stage', 'error');
      return;
    }
    if (stages.length <= 2) {
      showToast('Pipeline must have at least 2 stages', 'error');
      return;
    }
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
  };

  const handleMoveStage = (index: number, direction: 'left' | 'right') => {
    if (!canEdit) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;
    setStages(newStages);
  };

  const handleSaveWorkflow = async () => {
    if (!canEdit) {
      showToast('Permission denied to save workflow', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cid = activeCompanyId || localStorage.getItem('companyId');

      const payload = {
        company_id: cid,
        department_id: selectedDepartmentFilter !== 'ALL' ? selectedDepartmentFilter : null,
        stages: stages.map((s, idx) => ({ ...s, position: idx + 1 })),
      };

      const res = await fetch(`${API_BASE}/api/v1/workbridge/workflows`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Workflow pipeline saved! 🚀', 'success');
        fetchWorkflow();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save workflow', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error saving workflow', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Department filter options for main page header (Clean English)
  const departmentFilterOptions = [
    { value: 'ALL', label: 'All Departments' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.cleanName || d.name || d.department_name,
    })),
  ];

  // Department options for drawer dropdown (Clean English, No icons)
  const departmentFormOptions = [
    { value: '', label: 'All Departments (Global Standard)' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.cleanName || d.name || d.department_name,
    })),
  ];

  // Position options for "Insert After" dropdown (100% Clean English)
  const positionOptions = [
    { value: '-2', label: 'At the Beginning (Step #1)' },
    ...stages.map((s, idx) => ({
      value: String(idx),
      label: `After Step #${idx + 1}: ${s.name}`,
    })),
    { value: '-1', label: 'At the End (Last Step)' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn select-none relative">
      <DashboardPageHeader
        title="Workflow"
        subtitle="Configure dynamic Kanban stage pipelines and task progression rules"
      />

      {/* Main Container */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-card p-6 shadow-xs space-y-6">
        
        {/* Action Header & Department Filter */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Pipeline Stages</h3>
              <p className="text-xs text-slate-500 mt-0.5">Define uniform columns for team task movement and status progression</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            {/* Department Filter Bar */}
            <div className="w-full sm:w-64">
              <SearchableSelect
                options={departmentFilterOptions}
                value={selectedDepartmentFilter}
                onChange={(val) => {
                  setSelectedDepartmentFilter(val);
                  fetchWorkflow(val);
                }}
                placeholder="All Departments"
              />
            </div>

            {canCreate && (
              <button
                onClick={() => handleOpenStageDrawer()}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 font-bold rounded-xl shadow-2xs transition-all text-xs"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            )}

            {canEdit && (
              <button
                onClick={handleSaveWorkflow}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving Pipeline...' : 'Save Pipeline'}
              </button>
            )}
          </div>
        </div>

        {/* 100% Identical Grid Layout + Connecting Arrow Badges */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-7 h-7 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading Pipeline Stages...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4 items-stretch">
            {stages.map((stage, idx) => (
              <div key={stage.id || idx} className="flex items-center gap-2.5 md:gap-3">
                {/* Card Container */}
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-full relative group hover:border-blue-500 hover:shadow-sm transition-all overflow-hidden">
                  {/* Top Accent Color Bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: stage.color_code || '#2563eb' }}
                  />

                  <div className="pt-1">
                    {/* Step Header: Step Number & Actions */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        Step #{idx + 1}
                      </span>

                      {/* Controls */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleMoveStage(idx, 'left')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 rounded-md"
                              title="Move Left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveStage(idx, 'right')}
                              disabled={idx === stages.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 rounded-md"
                              title="Move Right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenStageDrawer(idx)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md transition-colors"
                              title="Edit Stage"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteStage(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Delete Stage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stage Title */}
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 leading-snug">
                      {stage.name}
                    </h4>
                  </div>

                  {/* Reserved Footer Container */}
                  <div className="min-h-[26px] pt-2.5 border-t border-slate-100 dark:border-slate-800/80 mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {stage.is_initial ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 px-2 py-0.5 rounded-md font-bold">
                          <CircleDashed className="w-3 h-3 text-blue-600" /> Entry Stage
                        </span>
                      ) : stage.is_final ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-2 py-0.5 rounded-md font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done / Closed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Standard Stage
                        </span>
                      )}
                    </div>

                    {stage.department_name && (
                      <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[90px]" title={stage.department_name}>
                        {stage.department_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Connecting Arrow Icon */}
                {idx < stages.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center p-1.5 bg-blue-50 dark:bg-slate-800/90 border border-blue-200/80 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-full shadow-2xs shrink-0 z-10 -mr-1">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide Drawer for Stage Add/Edit (100% Clean English) */}
      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingStageIndex !== null ? 'Edit Pipeline Stage' : 'Add New Pipeline Stage'}
      >
        <form onSubmit={handleSaveStage} className="space-y-4 text-slate-800 dark:text-white">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Stage Name *</label>
            <input
              type="text"
              required
              value={stageForm.name}
              onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
              placeholder="e.g. Code Review, QA Testing, Deployment"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Department Scope
            </label>
            <SearchableSelect
              options={departmentFormOptions}
              value={stageForm.department_id}
              onChange={(val) => setStageForm({ ...stageForm, department_id: val })}
              placeholder="Select Department..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Position (Insert After Stage)
            </label>
            <SearchableSelect
              options={positionOptions}
              value={String(stageForm.insert_after_index)}
              onChange={(val) => setStageForm({ ...stageForm, insert_after_index: parseInt(val, 10) })}
              placeholder="Select Position..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-blue-600" /> Column Color Theme
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={stageForm.color_code}
                onChange={(e) => setStageForm({ ...stageForm, color_code: e.target.value })}
                className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer bg-white"
              />
              <input
                type="text"
                value={stageForm.color_code}
                onChange={(e) => setStageForm({ ...stageForm, color_code: e.target.value })}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_initial"
                checked={stageForm.is_initial}
                onChange={(e) => setStageForm({ ...stageForm, is_initial: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white cursor-pointer"
              />
              <label htmlFor="is_initial" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-bold">
                Set as Entry / Initial Stage (Default for new tasks)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_final"
                checked={stageForm.is_final}
                onChange={(e) => setStageForm({ ...stageForm, is_final: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white cursor-pointer"
              />
              <label htmlFor="is_final" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-bold">
                Set as Final / Completed Stage
              </label>
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              Apply Stage
            </button>
          </div>
        </form>
      </SlideDrawer>
    </div>
  );
}
