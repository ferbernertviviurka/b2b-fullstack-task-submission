<?php

namespace App\Enums;

enum ApplicantStatus: string
{
    case Pending = 'pending';
    case Shortlisted = 'shortlisted';
    case Rejected = 'rejected';
}
