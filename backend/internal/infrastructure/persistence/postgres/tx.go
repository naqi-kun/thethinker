package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
)

var _ recommendation.Transactor = (*Transactor)(nil)

type txKeyType struct{}

var txKey = txKeyType{}

type dbQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func queryFromContext(ctx context.Context, pool *pgxpool.Pool) dbQuerier {
	if tx, ok := ctx.Value(txKey).(pgx.Tx); ok {
		return tx
	}
	return pool
}

type Transactor struct {
	db *pgxpool.Pool
}

func NewTransactor(db *pgxpool.Pool) *Transactor {
	return &Transactor{db: db}
}

func (t *Transactor) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	tx, err := t.db.Begin(ctx)
	if err != nil {
		return err
	}
	txCtx := context.WithValue(ctx, txKey, tx)
	if err := fn(txCtx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	return tx.Commit(ctx)
}
