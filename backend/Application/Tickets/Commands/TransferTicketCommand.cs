namespace TickeX.Application.Tickets.Commands;

using MediatR;

public record TransferTicketCommand(
    Guid TicketId,
    Guid SenderUserId,
    string RecipientEmail,
    string? Note = null
) : IRequest<TransferTicketResult>;

public record TransferTicketResult(
    bool Success,
    string Message,
    string? Code = null,
    Guid? TransferId = null
);

