import os
import re

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from openpyxl import load_workbook

from accounts.models import Course, Semester, Unit


class Command(BaseCommand):
    help = 'Import programme and unit records from the university workbook.'

    PROGRAMME_COLUMNS = {'Code', 'Full Name', 'Level', 'Status', 'Source'}
    UNIT_COLUMNS = {
        'Programme/Cohort',
        'Year',
        'Semester',
        'Estimated Total Years',
        'Estimated Total Semesters',
        'Unit Code',
        'Unit Name',
        'Programme Name',
    }
    ROMAN_NUMERALS = {
        'i': 'I', 'ii': 'II', 'iii': 'III', 'iv': 'IV', 'v': 'V',
        'vi': 'VI', 'vii': 'VII', 'viii': 'VIII', 'ix': 'IX', 'x': 'X',
    }

    @staticmethod
    def department_for_programme(code, name):
        text = f'{code} {name}'.casefold()
        if any(term in text for term in ('business', 'accounting', 'commerce', 'purchasing', 'economics')):
            return 'School of Business'
        if any(term in text for term in ('computer', 'information technology', 'software', 'cyber', 'ict')):
            return 'School of Computing and Informatics'
        if any(term in text for term in ('electrical', 'engineering')):
            return 'School of Engineering'
        if any(term in text for term in ('clinical', 'nursing', 'health')):
            return 'School of Health Sciences'
        if 'law' in text:
            return 'School of Law'
        if any(term in text for term in ('journalism', 'media', 'film', 'communication')):
            return 'School of Media and Communication'
        if any(term in text for term in ('hospitality', 'tourism', 'food and beverage')):
            return 'School of Hospitality and Tourism'
        if any(term in text for term in ('psychology', 'sociology', 'political', 'international relations')):
            return 'School of Social Sciences'
        return 'School of Business'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-existing',
            action='store_true',
            help='Delete all courses (and their units) before importing the workbook.',
        )
        parser.add_argument('--workbook', help='Path to the workbook; defaults to the backend master file.')

    @classmethod
    def normalize_unit_name(cls, value):
        title = ' '.join(str(value or '').split()).title()
        return re.sub(
            r'\b(?:I|Ii|Iii|Iv|V|Vi|Vii|Viii|Ix|X)\b',
            lambda match: cls.ROMAN_NUMERALS[match.group(0).lower()],
            title,
        )

    @staticmethod
    def _header_map(sheet):
        values = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ())
        return {
            str(value).strip(): index
            for index, value in enumerate(values)
            if value is not None and str(value).strip()
        }

    @staticmethod
    def _cell(row, headers, name):
        index = headers.get(name)
        return row[index] if index is not None and index < len(row) else None

    @staticmethod
    def _number(value):
        if value is None or str(value).strip() == '':
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            match = re.search(r'\d+', str(value))
            return int(match.group()) if match else None

    @classmethod
    def _programme_code(cls, cohort, programme_name, programme_codes):
        cohort_text = ' '.join(str(cohort or '').split())
        name_text = ' '.join(str(programme_name or '').split()).casefold()
        for code in sorted(programme_codes, key=len, reverse=True):
            if cohort_text.casefold() == code.casefold() or re.match(
                rf'^{re.escape(code)}(?:\b|\s|[-_/])', cohort_text, flags=re.IGNORECASE
            ):
                return code
        if name_text:
            for code, full_name in programme_codes.items():
                if name_text == full_name.casefold():
                    return code
        return None

    def read_workbook(self, excel_path):
        try:
            workbook = load_workbook(excel_path, read_only=True, data_only=True)
        except Exception as error:
            raise CommandError(f'Could not read workbook: {error}') from error

        required_sheets = {'All Programmes', 'Programmes'}
        missing_sheets = required_sheets - set(workbook.sheetnames)
        if missing_sheets:
            raise CommandError(
                'Workbook is not the cleaned version; missing sheet(s): '
                + ', '.join(sorted(missing_sheets))
            )

        programmes_sheet = workbook['Programmes']
        programmes_headers = self._header_map(programmes_sheet)
        missing_columns = self.PROGRAMME_COLUMNS - set(programmes_headers)
        if missing_columns:
            raise CommandError('Programmes sheet is missing columns: ' + ', '.join(sorted(missing_columns)))

        programmes = {}
        for row in programmes_sheet.iter_rows(min_row=2, values_only=True):
            code = ' '.join(str(self._cell(row, programmes_headers, 'Code') or '').split())
            if not code:
                continue
            full_name = ' '.join(str(self._cell(row, programmes_headers, 'Full Name') or '').split())
            programmes[code] = {
                'name': full_name or code,
                'department': self.department_for_programme(code, full_name),
                'academic_level': ' '.join(str(self._cell(row, programmes_headers, 'Level') or '').split()),
            }
        if not programmes:
            raise CommandError('Programmes sheet contains no programme codes.')

        units_sheet = workbook['All Programmes']
        units_headers = self._header_map(units_sheet)
        missing_columns = self.UNIT_COLUMNS - set(units_headers)
        if missing_columns:
            raise CommandError('All Programmes sheet is missing columns: ' + ', '.join(sorted(missing_columns)))

        units = {}
        previous = {'Programme/Cohort': None, 'Year': None, 'Semester': None}
        unknown_programmes = set()
        for row in units_sheet.iter_rows(min_row=2, values_only=True):
            values = {}
            for column in previous:
                value = self._cell(row, units_headers, column)
                if value is not None and str(value).strip():
                    previous[column] = value
                values[column] = previous[column]

            unit_code = ' '.join(str(self._cell(row, units_headers, 'Unit Code') or '').split())
            unit_name = self.normalize_unit_name(self._cell(row, units_headers, 'Unit Name'))
            if not unit_code or not unit_name:
                continue

            programme_code = self._programme_code(
                values['Programme/Cohort'],
                self._cell(row, units_headers, 'Programme Name'),
                {code: item['name'] for code, item in programmes.items()},
            )
            if not programme_code:
                unknown_programmes.add(str(values['Programme/Cohort'] or '').strip())
                continue

            year = self._number(values['Year'])
            semester = self._number(values['Semester'])
            if year is None or semester is None or year < 1 or semester < 1:
                continue
            units[(unit_code, programme_code)] = {
                'name': unit_name,
                'year_of_study': year,
                'semester': semester,
            }

        if unknown_programmes:
            examples = ', '.join(sorted(unknown_programmes)[:5])
            raise CommandError(f'Could not match cohort rows to Programmes codes: {examples}')
        if not units:
            raise CommandError('All Programmes sheet contains no valid unit rows.')
        workbook.close()
        return programmes, units

    def handle(self, *args, **options):
        excel_path = options['workbook'] or os.path.join(
            settings.BASE_DIR, 'Zetech_University_All_Programmes_Units.xlsx'
        )
        if not os.path.exists(excel_path):
            raise CommandError(f'Could not find the Excel file at: {excel_path}')

        programmes, units = self.read_workbook(excel_path)
        unit_codes = {code for code, _ in units}
        suspicious_programmes = sorted(
            code for code in programmes
            if code in unit_codes or re.fullmatch(r'[A-Za-z]{2,}\s*\d{3,}', code)
        )
        if suspicious_programmes:
            raise CommandError(
                'Programme codes look like unit codes: ' + ', '.join(suspicious_programmes[:10])
            )

        created_courses = 0
        created_units = 0
        updated_units = 0
        with transaction.atomic():
            if options['clear_existing']:
                Course.objects.all().delete()

            course_objects = {}
            for code, metadata in programmes.items():
                course = Course.objects.filter(code=code).first()
                created = course is None
                if course is None:
                    course = Course.objects.create(
                        code=code,
                        name=metadata['name'] or code,
                        department=metadata['department'],
                    )
                else:
                    course.name = metadata['name'] or code
                    if metadata['department']:
                        course.department = metadata['department']
                    course.save(update_fields=['name', 'department'])
                course_objects[code] = course
                created_courses += int(created)

            for (unit_code, programme_code), defaults in units.items():
                _, created = Unit.objects.update_or_create(
                    code=unit_code,
                    course=course_objects[programme_code],
                    defaults={
                        **defaults,
                        'academic_level': programmes[programme_code]['academic_level'],
                    },
                )
                Semester.objects.get_or_create(
                    year=defaults['year_of_study'],
                    semester=defaults['semester'],
                    defaults={
                        'name': f"Year {defaults['year_of_study']} Semester {defaults['semester']}",
                    },
                )
                created_units += int(created)
                updated_units += int(not created)

            # Preserve existing catalogue rows maintained outside the workbook.

        self.stdout.write(self.style.SUCCESS(
            f'Import complete: {Course.objects.count()} courses and {Unit.objects.count()} units '
            f'({created_courses} courses created, {created_units} units created, {updated_units} units updated).'
        ))