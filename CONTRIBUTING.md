# Contributing to NOCIQ

First off, thank you for considering contributing to NOCIQ! It's people like you that make NOCIQ such a great tool for network operations teams.

## 🌊 Participating in Stellar Wave

NOCIQ is part of the [Stellar Wave Program](https://www.drips.network/wave/stellar)! If you're here from the Wave:

1. **Browse Issues**: Look for issues tagged with `Stellar Wave`
2. **Apply to Work**: Comment on the issue you want to work on
3. **Get Assigned**: Wait for a maintainer to assign you
4. **Submit PR**: Create a pull request when ready

**Important**: Only one contributor per issue. First to apply and get assigned gets the work.

## 🤝 Ways to Contribute

There are many ways to contribute to NOCIQ:

- **Report bugs** and issues
- **Suggest new features** or enhancements
- **Fix bugs** and implement features
- **Improve documentation**
- **Write tests** to increase coverage
- **Review pull requests**
- **Help answer questions** in discussions

## 🚀 Getting Started

### Prerequisites

**For Frontend (noc-iq-fe):**
- Node.js 18.x or higher
- npm or yarn
- Git
- Freighter wallet (for Stellar features)

**For Backend (noc-iq-be):**
- Python 3.9 or higher
- pip and virtualenv
- Git

**For Smart Contracts (noc-iq-contracts):**
- Rust and Cargo
- Soroban CLI
- Stellar CLI

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/noc-iq-fe.git
   # or
   git clone https://github.com/YOUR_USERNAME/noc-iq-be.git
   # or
   git clone https://github.com/YOUR_USERNAME/noc-iq-contracts.git
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/OpSoll/noc-iq-fe.git
   ```

### Setup Development Environment

**Frontend:**
```bash
cd noc-iq-fe
npm install
cp .env.example .env.local
# Edit .env.local with your config
npm run dev
```

**Backend:**
```bash
cd noc-iq-be
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your config
uvicorn main:app --reload
```

**Smart Contracts:**
```bash
cd noc-iq-contracts
# Install Soroban CLI if you haven't
cargo install --locked soroban-cli
# Build contracts
make build
# Run tests
make test
```

## 📝 Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/wallet-integration
# or
git checkout -b fix/payment-bug
# or
git checkout -b docs/stellar-guide
```

**Branch naming convention:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `test/description` - Adding tests
- `refactor/description` - Code refactoring

### 2. Make Your Changes

- Write clean, readable code
- Follow the project's code style (see below)
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

**Frontend:**
```bash
npm run test
npm run lint
npm run type-check
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add wallet balance display"
git commit -m "fix: resolve payment timeout issue"
git commit -m "docs: update stellar integration guide"
git commit -m "test: add unit tests for SLA calculator"
```

## 🎨 UI Component Guidelines

When building shared UI components in `src/components/ui/`:

- **Radix UI Primitives**: Use underlying Radix UI / shadcn primitives for accessibility (keyboard navigation, ARIA roles, focus management).
- **Tailwind CSS Tokens**: Always utilize Tailwind CSS classes and design tokens. Avoid hardcoded static styles or inline style objects.
- **Component File Structure**: Place reusable primitives in `src/components/ui/` and domain-specific feature cards under `src/app/<feature>/components/`.
- **Keyboard & High Contrast Focus**: Ensure interactive controls include explicit `focus-visible:ring-2` styles and satisfy WCAG 2.1 AA 4.5:1 text contrast ratios.

## 🧪 Writing Vitest Hook Tests

Custom React hooks in `src/hooks/` should be covered using `@testing-library/react` and Vitest:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';
import { describe, it, expect } from 'vitest';

describe('useCounter hook', () => {
  it('increments counter value correctly', () => {
    const { result } = renderHook(() => useCounter());

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

## 🔑 Query Key Conventions

For TanStack React Query cache safety and predictable invalidation, structure query keys using hierarchical arrays:

- **Resource Scope**: Begin with the domain noun (e.g. `['wallet']`, `['sessions']`).
- **Sub-resource & Param Scope**: Include specific sub-resources and parameters as subsequent array elements: `['wallet', 'status', userId]`.
- **Consistency**: Never use plain un-arrayed string keys or dynamically concatenated strings (`"wallet-status-" + userId`).

```typescript
// ✅ Good: Hierarchical array query key
useQuery({
  queryKey: ['wallet', 'status', userId],
  queryFn: () => fetchWalletStatus(userId),
});
```

## 🎨 Code Style Guidelines

### Frontend (TypeScript/React)

- Use **TypeScript** for all new files
- Follow **React hooks** best practices
- Use **functional components** over class components
- Use **Tailwind CSS** for styling (no inline styles)

## 📜 License

By contributing to NOCIQ, you agree that your contributions will be licensed under the MIT License.
