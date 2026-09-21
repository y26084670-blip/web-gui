[CmdletBinding(DefaultParameterSetName = 'Finish')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Start')]
    [switch] $Start,
    [Parameter(Mandatory = $true, ParameterSetName = 'Finish')]
    [long] $StartedAt,
    [Parameter(Mandatory = $true, ParameterSetName = 'Finish')]
    [string] $Label
)

# Stopwatch is monotonic: midnight, timezone and clock corrections do not affect it.
if ($Start) {
    [Diagnostics.Stopwatch]::GetTimestamp()
    return
}

$minutes = ([Diagnostics.Stopwatch]::GetTimestamp() - $StartedAt) /
    [double] [Diagnostics.Stopwatch]::Frequency / 60.0
[Console]::WriteLine([string]::Format(
    [Globalization.CultureInfo]::InvariantCulture,
    'Время сборки [{0}]: {1:F2} мин.', $Label, $minutes
))
