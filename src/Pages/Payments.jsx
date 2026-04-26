import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  CreditCard,
  ReceiptText,
  RotateCw,
  Shield,
  WalletCards,
} from "lucide-react";
import { PageHero, SiteLayout } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function formatPrice(amountCents, currency) {
  return `${(Number(amountCents || 0) / 100).toLocaleString()} ${currency || "EGP"}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function paymentLabel(status) {
  if (status === "paid") {
    return "Confirmed";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Pending";
}

function stageLabel(payment) {
  if (payment?.currentStageLabel) {
    return payment.currentStageLabel;
  }

  if (payment?.paymentStage === "remaining") {
    return "Remaining balance";
  }

  if (payment?.paymentStage === "full") {
    return "Full payment";
  }

  return "Deposit";
}

function planLabel(payment) {
  if (payment?.paymentPlanLabel) {
    return payment.paymentPlanLabel;
  }

  if (payment?.paymentPlan === "full") {
    return "Full payment";
  }

  if (payment?.paymentPlan === "three_payments") {
    return "3 payments";
  }

  return "Installment";
}

function installmentStepLabel(payment, index) {
  const installmentCount = payment?.installmentCount || payment?.paymentPlanDetails?.installmentCount || 1;
  const depositPercentage = payment?.paymentPlanDetails?.depositPercentage || 15;

  if (payment?.paymentPlan === "installment" && index === 0) {
    return `${depositPercentage}% deposit`;
  }

  if (installmentCount === 1) {
    return "Full payment";
  }

  if (index === installmentCount - 1) {
    return "Final payment";
  }

  return `Payment ${index + 1} of ${installmentCount}`;
}

function installmentStatus(payment, index) {
  const installmentNumber = index + 1;

  if (installmentNumber <= (payment?.completedInstallmentCount || 0)) {
    return {
      label: "Paid",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (payment?.status === "pending" && installmentNumber === payment?.installmentIndex) {
    return {
      label: payment.isPastDue ? "Overdue" : "Due now",
      className: payment.isPastDue ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-700",
    };
  }

  if (installmentNumber === payment?.nextInstallmentIndex) {
    return {
      label: "Upcoming",
      className: "bg-purple-50 text-purple-700",
    };
  }

  return {
    label: "Planned",
    className: "bg-slate-100 text-slate-600",
  };
}

export default function Payments() {
  const { loading, isAuthenticated } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const paymentStatus = searchParams.get("status") || "";
  const [payment, setPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayment, setLoadingPayment] = useState(Boolean(paymentId));
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingRemaining, setCreatingRemaining] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPayments = useCallback(async () => {
    setLoadingHistory(true);

    try {
      const payload = await api.get("/payments");
      setPayments(payload.payments || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadPayment = useCallback(
    async ({ showSpinner = true, silent = false } = {}) => {
      if (!paymentId) {
        setPayment(null);
        setLoadingPayment(false);
        return;
      }

      if (showSpinner) {
        setLoadingPayment(true);
      }
      if (!silent) {
        setError("");
      }

      try {
        const payload = await api.get(`/payments/${paymentId}`);
        setPayment(payload.payment);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        if (showSpinner) {
          setLoadingPayment(false);
        }
      }
    },
    [paymentId],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadPayments();
  }, [isAuthenticated, loadPayments]);

  useEffect(() => {
    if (isAuthenticated) {
      loadPayment();
    }
  }, [isAuthenticated, loadPayment]);

  useEffect(() => {
    if (paymentStatus === "processing") {
      setMessage("We are checking the payment confirmation now.");
    } else if (paymentStatus === "failed") {
      setError("The payment provider did not confirm this checkout.");
    }
  }, [paymentStatus]);

  useEffect(() => {
    if (!isAuthenticated || !paymentId || paymentStatus !== "processing" || payment?.status !== "pending") {
      return;
    }

    const interval = window.setInterval(() => {
      loadPayment({ showSpinner: false, silent: true });
      loadPayments();
    }, 4000);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 45000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [isAuthenticated, loadPayment, loadPayments, payment?.status, paymentId, paymentStatus]);

  const currentPayment = useMemo(() => {
    if (payment) {
      return payment;
    }

    return payments.find((entry) => entry.id === paymentId) || null;
  }, [payment, paymentId, payments]);

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  async function handleContinuePayment() {
    if (!currentPayment) {
      return;
    }

    if (currentPayment.mode !== "mock" && currentPayment.checkoutUrl) {
      window.location.assign(currentPayment.checkoutUrl);
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/payments/${currentPayment.id}/mock-complete`, {});
      await Promise.all([
        loadPayment({ showSpinner: false, silent: true }),
        loadPayments(),
      ]);
      setMessage("Payment confirmed.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCreateRemainingCheckout() {
    if (!currentPayment) {
      return;
    }

    if (currentPayment.pendingNextPaymentId) {
      setSearchParams({ paymentId: currentPayment.pendingNextPaymentId });
      return;
    }

    setCreatingRemaining(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post(`/payments/${currentPayment.id}/create-remaining-checkout`, {});
      await loadPayments();
      setSearchParams({ paymentId: payload.payment.id });
      setMessage("Remaining balance checkout created.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setCreatingRemaining(false);
    }
  }

  async function handleRefreshPayment() {
    setRefreshing(true);
    await Promise.all([
      loadPayment({ showSpinner: false, silent: true }),
      loadPayments(),
    ]);
    setRefreshing(false);
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Payments"
        title="Track full payments, deposits, and every scheduled installment."
        description="Students can choose full payment, a 15% deposit plan, or 3 payments and always see what is paid, what is due next, and what is still left."
      />

      <section className="px-6 py-14 md:px-12">
        <div className="mx-auto max-w-6xl">
          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              {loadingPayment ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
                  <p className="text-lg font-semibold text-primary">Loading payment details...</p>
                </div>
              ) : currentPayment ? (
                <>
                <div className="surface-card p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">
                        {stageLabel(currentPayment)}
                      </p>
                      <h2 className="mt-3 text-3xl font-bold text-primary">{currentPayment.courseTitle}</h2>
                    </div>
                    <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                      {paymentLabel(currentPayment.status)}
                    </span>
                  </div>

                    <div className="mt-8 grid gap-5 md:grid-cols-4">
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                      <p className="text-sm font-semibold text-purple-700">This payment</p>
                      <p className="mt-2 text-2xl font-extrabold text-text">
                        {formatPrice(currentPayment.amountCents, currentPayment.currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                      <p className="text-sm font-semibold text-purple-700">Plan</p>
                      <p className="mt-2 text-2xl font-extrabold text-text">{planLabel(currentPayment)}</p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                      <p className="text-sm font-semibold text-purple-700">Full price</p>
                      <p className="mt-2 text-2xl font-extrabold text-text">
                        {formatPrice(currentPayment.fullAmountCents, currentPayment.currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                      <p className="text-sm font-semibold text-purple-700">Still left</p>
                      <p className="mt-2 text-2xl font-extrabold text-text">
                        {formatPrice(currentPayment.remainingCents || 0, currentPayment.currency)}
                      </p>
                    </div>
                  </div>

                    <div className="mt-8 grid gap-4 rounded-3xl border border-purple-100 bg-white px-6 py-6">
                      <div className="flex items-center gap-3 text-purple-700">
                        <Shield size={20} />
                        <p className="font-semibold">Your access and reminders stay linked to this payment record.</p>
                      </div>

                    {currentPayment.dueAt ? (
                      <p className={`text-sm leading-7 ${currentPayment.isPastDue ? "text-red-600" : "text-slate-700"}`}>
                        {currentPayment.isPastDue ? `${currentPayment.dueStageLabel} is overdue since ` : `${currentPayment.dueStageLabel} is due by `}
                        {formatDate(currentPayment.dueAt)}.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      {currentPayment.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={handleContinuePayment}
                            disabled={processing}
                            className="primary-btn w-fit disabled:opacity-70"
                          >
                            <CreditCard size={16} />
                            {processing
                              ? "Confirming..."
                              : currentPayment.mode === "live"
                                ? "Continue Checkout"
                                : "Confirm Payment"}
                          </button>
                          <button
                            type="button"
                            onClick={handleRefreshPayment}
                            disabled={refreshing}
                            className="secondary-btn !border-primary !text-primary disabled:opacity-70"
                          >
                            <RotateCw size={16} />
                            {refreshing ? "Refreshing..." : "Refresh"}
                          </button>
                        </>
                      ) : null}

                      {currentPayment.status === "paid" &&
                      currentPayment.paymentPlan !== "full" &&
                      currentPayment.remainingCents > 0 ? (
                        <button
                          type="button"
                          onClick={handleCreateRemainingCheckout}
                          disabled={creatingRemaining}
                          className="primary-btn w-fit disabled:opacity-70"
                        >
                          <WalletCards size={16} />
                          {creatingRemaining
                            ? "Preparing..."
                            : currentPayment.pendingNextPaymentId
                              ? "Open Next Payment"
                              : currentPayment.paymentPlan === "three_payments"
                                ? "Prepare Next Installment"
                                : "Pay Remaining Balance"}
                        </button>
                      ) : null}

                      {currentPayment.status === "paid" ? (
                        <Link to={`/courses/${currentPayment.courseSlug || currentPayment.courseId}`} className="secondary-btn !border-primary !text-primary">
                          Open Course
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="surface-card mt-6 p-8">
                  <div className="flex items-center gap-3 text-purple-700">
                    <WalletCards size={20} />
                    <h3 className="text-2xl font-bold text-primary">Plan breakdown</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {currentPayment.paymentPlanDetails?.summary || "Each payment stays visible here until the course is fully settled."}
                  </p>
                  <div className="mt-6 grid gap-4">
                    {(currentPayment.paymentPlanDetails?.installments || []).map((amount, index) => {
                      const status = installmentStatus(currentPayment, index);
                      return (
                        <div key={`${currentPayment.id}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{installmentStepLabel(currentPayment, index)}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatPrice(amount, currentPayment.currency)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </>
              ) : (
                <div className="surface-card p-8">
                  <h2 className="text-2xl font-bold text-primary">No payment selected</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Choose a record from the payment history or start from a course page.
                  </p>
                  <div className="mt-5">
                    <Link to="/courses" className="primary-btn">
                      Browse Courses
                    </Link>
                  </div>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-3">
                <div className="surface-card p-6">
                  <div className="flex items-center gap-3 text-purple-700">
                    <ReceiptText size={20} />
                    <h3 className="text-lg font-bold text-primary">15% deposit plan</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Pay the deposit first, unlock the course, then return here to settle the remaining balance before the course ends.
                  </p>
                </div>

                <div className="surface-card p-6">
                  <div className="flex items-center gap-3 text-purple-700">
                    <WalletCards size={20} />
                    <h3 className="text-lg font-bold text-primary">3 payments</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Students can split the full course fee into 3 scheduled payments and keep each step visible in the same account.
                  </p>
                </div>

                <div className="surface-card p-6">
                  <div className="flex items-center gap-3 text-purple-700">
                    <CheckCircle2 size={20} />
                    <h3 className="text-lg font-bold text-primary">Full payment</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Students can still finish the whole course amount in one step whenever they prefer a single checkout.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="surface-card p-8">
                <div className="flex items-center gap-3 text-purple-700">
                  <ReceiptText size={20} />
                  <h3 className="text-2xl font-bold text-primary">Payment history</h3>
                </div>

                <div className="mt-6 grid gap-4">
                  {loadingHistory ? (
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm text-slate-600">
                      Loading history...
                    </div>
                  ) : payments.length ? (
                    payments.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSearchParams({ paymentId: entry.id })}
                        className={`grid gap-3 rounded-2xl border px-5 py-5 text-left transition ${
                          paymentId === entry.id
                            ? "border-primary bg-purple-50"
                            : "border-purple-100 bg-white hover:border-purple-200"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-primary">{entry.courseTitle}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {stageLabel(entry)} - {planLabel(entry)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                            {paymentLabel(entry.status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                          <span>{formatPrice(entry.amountCents, entry.currency)}</span>
                          <span>{formatDate(entry.updatedAt || entry.createdAt)}</span>
                        </div>
                        {(entry.checkoutDueAt || entry.remainingDueAt) ? (
                          <p className={`text-sm ${entry.isPastDue ? "text-red-600" : "text-slate-600"}`}>
                            Due {formatDate(entry.dueAt || entry.checkoutDueAt || entry.remainingDueAt)}
                          </p>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm leading-7 text-slate-600">
                      No payments yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center gap-3 text-purple-700">
                  <Shield size={20} />
                  <h3 className="text-2xl font-bold text-primary">What admins can see</h3>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-600">
                  Due-soon reminders, past-due balances, and payment history flow into the admin or moderator dashboard so staff can follow up before a balance becomes a bigger issue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
