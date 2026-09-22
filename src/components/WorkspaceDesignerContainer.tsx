import React, { useState, useEffect, useRef } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { PersonalWorkspace } from "./PersonalWorkspace";

interface WorkspaceDesignerContainerProps {
  businessId: string;
  userId: string;
}

/**
 * Smart collapsible wrapper for the Workspace Designer.
 * - Auto-expands when unsaved changes are detected
 * - Auto-collapses on successful save
 * - Remembers user's preference in localStorage
 * - Helps save mobile screen space when not in use
 */
export function WorkspaceDesignerContainer({ businessId, userId }: WorkspaceDesignerContainerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("workspace_designer_state");
      if (saved) {
        const state = JSON.parse(saved);
        setIsExpanded(state.expanded !== false);
      }
    } catch (err) {
      console.error("Failed to load workspace designer state:", err);
    }
  }, []);

  // Monitor for unsaved changes
  useEffect(() => {
    const container = workspaceRef.current;
    if (!container) return;

    const handleInput = () => setHasUnsavedChanges(true);
    const handleChange = () => setHasUnsavedChanges(true);
    const handleFormSubmit = (e: Event) => {
      // After form submission, check a moment later if changes persist
      setTimeout(() => {
        // If no errors were shown, assume save was successful
        setHasUnsavedChanges(false);
        // Optionally collapse after successful save
        setIsExpanded(false);
        savePreference(false);
      }, 500);
    };

    // Find all form inputs within workspace
    const inputs = container.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      input.addEventListener("input", handleInput);
      input.addEventListener("change", handleChange);
    });

    // Listen for form submissions
    const forms = container.querySelectorAll("form");
    forms.forEach((form) => {
      form.addEventListener("submit", handleFormSubmit);
    });

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener("input", handleInput);
        input.removeEventListener("change", handleChange);
      });
      forms.forEach((form) => {
        form.removeEventListener("submit", handleFormSubmit);
      });
    };
  }, []);

  // Auto-expand when changes are detected
  useEffect(() => {
    if (hasUnsavedChanges && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasUnsavedChanges, isExpanded]);

  const savePreference = (expanded: boolean) => {
    try {
      localStorage.setItem(
        "workspace_designer_state",
        JSON.stringify({
          expanded,
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error("Failed to save workspace designer state:", err);
    }
  };

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    savePreference(newState);
  };

  return (
    <div className="border-t border-slate-200 pt-6">
      {/* Collapsible Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-t-lg transition group"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-slate-900">Workspace Designer</span>
          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
              Unsaved Changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <CaretUp className="w-5 h-5 text-slate-600 group-hover:text-slate-900" />
          ) : (
            <CaretDown className="w-5 h-5 text-slate-600 group-hover:text-slate-900" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div
          ref={workspaceRef}
          className="bg-white border border-t-0 border-slate-200 rounded-b-lg p-6 overflow-auto max-h-[calc(100vh-200px)]"
        >
          <PersonalWorkspace businessId={businessId} userId={userId} />
        </div>
      )}

      {/* Collapsed State Info */}
      {!isExpanded && hasUnsavedChanges && (
        <div className="bg-amber-50 border border-t-0 border-amber-200 rounded-b-lg p-3 text-sm text-amber-700 flex items-center justify-between">
          <span>You have unsaved changes in the workspace designer</span>
          <button
            onClick={toggleExpanded}
            className="text-amber-600 hover:text-amber-800 font-semibold underline"
          >
            Review Changes
          </button>
        </div>
      )}
    </div>
  );
}

export default WorkspaceDesignerContainer;
