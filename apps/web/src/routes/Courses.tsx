import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCourse, listCourses } from '../lib/api';
import type { Course } from '../lib/types';
import { ErrorBanner, Loading } from '../components/ui';

/** Courses screen: list courses and create a new one. */
export function Courses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setError(null);
    try {
      setCourses(await listCourses());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Load once on mount.
  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createCourse(trimmed);
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="text-slate-600">Your professor-to-textbook bridges.</p>
      </header>

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          className="flex-1 rounded border border-slate-300 px-3 py-2"
          placeholder="New course name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New course name"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error && <ErrorBanner message={error} />}
      {!courses && !error && <Loading />}

      {courses && courses.length === 0 && (
        <p className="text-sm text-slate-500">No courses yet. Create one above.</p>
      )}

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {courses?.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-500">
                Created {new Date(c.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              to={`/courses/${encodeURIComponent(c.id)}/documents`}
              className="text-sm font-medium text-blue-700"
            >
              Open →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
