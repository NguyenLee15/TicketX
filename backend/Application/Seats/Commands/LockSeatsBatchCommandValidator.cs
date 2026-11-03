using FluentValidation;

namespace TickeX.Application.Seats.Commands;

public class LockSeatsBatchCommandValidator : AbstractValidator<LockSeatsBatchCommand>
{
    public LockSeatsBatchCommandValidator()
    {
        RuleFor(x => x.EventId).NotEmpty().WithMessage("EventId is required.");
        RuleFor(x => x.UserId).NotEmpty().WithMessage("UserId is required.");
        RuleFor(x => x.SeatIds)
            .NotEmpty().WithMessage("Danh sách ghế không được để trống.")
            .Must(seats => seats != null && seats.Count is >= 1 and <= 4)
            .WithMessage("Mỗi lần đặt vé chỉ được chọn từ 1 đến 4 ghế.")
            .Must(seats => seats != null && seats.Distinct().Count() == seats.Count)
            .WithMessage("Danh sách ghế không được trùng lặp.")
            .Must(seats => seats != null && seats.All(s => s != Guid.Empty))
            .WithMessage("Định danh ghế không hợp lệ.");

        RuleFor(x => x.SeatVersions)
            .NotNull().WithMessage("SeatVersions is required.")
            .Must((cmd, versions) => versions != null && cmd.SeatIds != null && cmd.SeatIds.All(id => versions.ContainsKey(id) && versions[id] != null && versions[id].Length == 16))
            .WithMessage("Mỗi ghế phải có mã phiên bản đồng thời (version token) 16 bytes hợp lệ.");
    }
}

